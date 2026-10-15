// Outbound money movement (winner payouts and refunds) goes through a
// Cloudflare Queue so provider slowness/failure never blocks settlement and
// failed transfers are retried with backoff. Redelivery is safe because every
// job carries an idempotency key that the provider adapter uses as its
// reference. Messages that exhaust retries land in the dead-letter queue for
// admin follow-up. Each attempt outcome is appended to the immutable ledger,
// and actions already pending/successful in the ledger are never resent.

import { log } from "./logger.js"
import type { PaymentProvider, PaymentResult, PayoutRequest, RefundRequest } from "@surescore/shared";
import { createProviderRegistry } from "../providers/registry.js";
import { ensureRecipient } from "./payout-recipient.js";
import { PrismaLedgerStore, type LedgerStore } from "./ledger.js";

/** `attemptOffset` keeps ledger attempt numbers unique when an admin re-queues a failed action. */
export type TransferJob = { attemptOffset?: number } & (
	| { type: "payout"; request: PayoutRequest }
	| { type: "refund"; request: RefundRequest }
);

const RETRY_BASE_DELAY_SECONDS = 30;
const MAX_RETRY_DELAY_SECONDS = 3600;

export const enqueueTransfer = (env: Env, job: TransferJob) => env.TRANSFER_QUEUE.send(job);

export const enqueueTransfers = (env: Env, jobs: TransferJob[]) =>
	env.TRANSFER_QUEUE.sendBatch(jobs.map((body) => ({ body })));

export const retryDelaySeconds = (attempts: number) =>
	Math.min(RETRY_BASE_DELAY_SECONDS * 2 ** (attempts - 1), MAX_RETRY_DELAY_SECONDS);

type ResolveRecipient = (provider: PaymentProvider, request: PayoutRequest) => Promise<string>;

async function executeTransfer(provider: PaymentProvider, job: TransferJob, resolveRecipient: ResolveRecipient): Promise<PaymentResult> {
	if (job.type === "refund") return provider.refund(job.request);
	const recipientCode = job.request.recipientCode ?? (await resolveRecipient(provider, job.request));
	return provider.payout({ ...job.request, recipientCode });
}

export async function handleTransferBatch(
	batch: MessageBatch<TransferJob>,
	env: Env,
	deps: {
		resolveProvider?: (countryCode: string) => PaymentProvider;
		ledger?: LedgerStore;
		resolveRecipient?: ResolveRecipient;
		/** Called once a refund is confirmed successful by the provider. */
		onRefunded?: (potId: string) => Promise<unknown>;
	} = {},
) {
	const registry = createProviderRegistry(env);
	const resolveProvider =
		deps.resolveProvider ?? ((country: string) => registry.resolvePaymentProviderForCountry(country));
	const resolveRecipient: ResolveRecipient =
		deps.resolveRecipient ?? ((provider, req) => ensureRecipient(env, provider, req.payoutAccountId, req.currency));
	const ledger = deps.ledger ?? new PrismaLedgerStore(env.DB);

	for (const message of batch.messages) {
		const { body } = message;
		const { request } = body;
		const retry = () => message.retry({ delaySeconds: retryDelaySeconds(message.attempts) });
		const entry = {
			type: body.type,
			userId: request.userId,
			potId: request.potId,
			countryCode: request.countryCode,
			currency: request.currency,
			amountMinorUnits: request.amountMinorUnits,
			idempotencyKey: request.idempotencyKey,
			attempt: (body.attemptOffset ?? 0) + message.attempts,
		} as const;

		try {
			if (await ledger.isInFlightOrDone(request.idempotencyKey)) {
				message.ack();
				continue;
			}

			const provider = resolveProvider(request.countryCode);
			try {
				const result = await executeTransfer(provider, body, resolveRecipient);
				await ledger.append({ ...entry, status: result.status, provider: result.provider, reference: result.reference });
				if (result.status === "successful" && body.type === "refund") {
					await deps.onRefunded?.(request.potId);
				}
				result.status === "failed" ? retry() : message.ack();
			} catch (error) {
				await ledger.append({ ...entry, status: "failed", provider: provider.id, detail: String(error) });
				throw error;
			}
		} catch (error) {
			log.error(body.type === "refund" ? "refund" : "payout", "transfer_failed", { idempotencyKey: request.idempotencyKey, error });
			retry();
		}
	}
}
