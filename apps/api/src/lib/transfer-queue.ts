// Outbound money movement (winner payouts and refunds) goes through a
// Cloudflare Queue so provider slowness/failure never blocks settlement and
// failed transfers are retried with backoff. Redelivery is safe because every
// job carries an idempotency key that the provider adapter uses as its
// reference. Messages that exhaust retries land in the dead-letter queue for
// admin follow-up. Each attempt outcome is appended to the immutable ledger,
// and actions already pending/successful in the ledger are never resent.

import type { PaymentProvider, PaymentResult, PayoutRequest, RefundRequest } from "@surescore/shared";
import { createProviderRegistry } from "../providers/registry.js";
import { PrismaLedgerStore, type LedgerStore } from "./ledger.js";

export type TransferJob =
	| { type: "payout"; request: PayoutRequest }
	| { type: "refund"; request: RefundRequest };

const RETRY_BASE_DELAY_SECONDS = 30;
const MAX_RETRY_DELAY_SECONDS = 3600;

export const enqueueTransfer = (env: Env, job: TransferJob) => env.TRANSFER_QUEUE.send(job);

export const enqueueTransfers = (env: Env, jobs: TransferJob[]) =>
	env.TRANSFER_QUEUE.sendBatch(jobs.map((body) => ({ body })));

export const retryDelaySeconds = (attempts: number) =>
	Math.min(RETRY_BASE_DELAY_SECONDS * 2 ** (attempts - 1), MAX_RETRY_DELAY_SECONDS);

const executeTransfer = (provider: PaymentProvider, job: TransferJob): Promise<PaymentResult> =>
	job.type === "payout" ? provider.payout(job.request) : provider.refund(job.request);

export async function handleTransferBatch(
	batch: MessageBatch<TransferJob>,
	env: Env,
	deps: {
		resolveProvider?: (countryCode: string) => PaymentProvider;
		ledger?: LedgerStore;
	} = {},
) {
	const registry = createProviderRegistry(env);
	const resolveProvider =
		deps.resolveProvider ?? ((country: string) => registry.resolvePaymentProviderForCountry(country));
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
			attempt: message.attempts,
		} as const;

		try {
			if (await ledger.isInFlightOrDone(request.idempotencyKey)) {
				message.ack();
				continue;
			}

			const provider = resolveProvider(request.countryCode);
			try {
				const result = await executeTransfer(provider, body);
				await ledger.append({ ...entry, status: result.status, provider: result.provider, reference: result.reference });
				result.status === "failed" ? retry() : message.ack();
			} catch (error) {
				await ledger.append({ ...entry, status: "failed", provider: provider.id, detail: String(error) });
				throw error;
			}
		} catch (error) {
			console.error(`Transfer ${body.type} failed, will retry:`, request.idempotencyKey, error);
			retry();
		}
	}
}
