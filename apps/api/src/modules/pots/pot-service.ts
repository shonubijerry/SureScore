// Pot lifecycle orchestration. Pure rules live in @surescore/shared
// (pot-rules); this module applies them to storage, the payment provider
// (resolved by country config) and the transfer queue. Every state change goes
// through `transition`, which is the single place that writes the audit trail.

import { log } from '../../platform/logger.js'
import { HTTPException } from 'hono/http-exception'
import { createDbClient, type Pot } from '@surescore/db'
import {
	assertCountrySupported,
	canPotterCancel,
	canTransition,
	getCountryConfig,
	isMatchBookable,
	nextAutomaticTransition,
	refundAmountFor,
	resolveSportsProviderForCountry,
	MAX_WINNER_COUNT,
	MIN_WINNER_COUNT,
	type MatchStatus,
	type PaymentResult,
	type PotStatus,
	type RefundReason,
} from '@surescore/shared'
import { createProviderRegistry } from '../../providers/registry.js'
import { PrismaLedgerStore, type LedgerStore } from '../payments/ledger.js'
import { enqueueTransfer, type TransferJob } from '../payments/transfer-queue.js'
import { pickPayoutAccount } from '../payments/payout-recipient.js'

export interface Actor {
	type: 'user' | 'system' | 'admin'
	id?: string
}

export const SYSTEM_ACTOR: Actor = { type: 'system' }

const ACTIVE_STATUSES: PotStatus[] = ['Draft', 'Funded', 'Open', 'Locked', 'Live']
const SHARE_CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

export function fail(status: 400 | 403 | 404 | 409 | 422, message: string): never {
	throw new HTTPException(status, { message })
}

function generateShareCode(length = 10) {
	const bytes = crypto.getRandomValues(new Uint8Array(length))
	return Array.from(bytes, (b) => SHARE_CODE_ALPHABET[b % SHARE_CODE_ALPHABET.length]).join('')
}

export class PotService {
	private readonly db
	private readonly ledger: LedgerStore

	constructor(
		private readonly env: Env,
		ledger?: LedgerStore,
	) {
		this.db = createDbClient(env.DB)
		this.ledger = ledger ?? new PrismaLedgerStore(env.DB)
	}

	/** Moves a pot to `to` if it is still in `pot.status`; returns false if it lost a race. */
	async transition(
		pot: Pick<Pot, 'id' | 'status'>,
		to: PotStatus,
		actor: Actor,
		reason: string,
		data: Partial<Pick<Pot, 'shareCode' | 'fundingReference'>> = {},
	) {
		if (!canTransition(pot.status as PotStatus, to)) {
			throw new Error(`Illegal pot transition ${pot.status} -> ${to}`)
		}
		const { count } = await this.db.pot.updateMany({
			where: { id: pot.id, status: pot.status },
			data: { status: to, ...data },
		})
		if (count === 0) return false
		await this.db.potStateTransition.create({
			data: { potId: pot.id, fromStatus: pot.status, toStatus: to, actorType: actor.type, actorId: actor.id, reason },
		})
		return true
	}

	/** Cancels a pot; anything already funded is refunded through the transfer queue. */
	async cancel(pot: Pot, actor: Actor, reason: RefundReason) {
		if (!(await this.transition(pot, 'Cancelled', actor, reason))) return false
		if (pot.status !== 'Draft') await enqueueTransfer(this.env, await this.refundJobFor(pot, reason))
		return true
	}

	/**
	 * Refund job for a pot. The refund is transferred to the potter's chosen
	 * refund account, falling back to their default account if it was removed;
	 * pots created before refund accounts existed reverse the funding payment.
	 */
	async refundJobFor(pot: Pot, reason: RefundReason): Promise<TransferJob> {
		const accounts = await this.db.payoutAccount.findMany({
			where: { userId: pot.potterId, deletedAt: null },
			select: { id: true, countryCode: true, isDefault: true },
		})
		const account = accounts.find((a) => a.id === pot.refundAccountId) ?? pickPayoutAccount(accounts, pot.countryCode)
		return PotService.refundJob(pot, reason, pot.refundAccountId ? account?.id : undefined)
	}

	static refundJob(pot: Pot, reason: RefundReason, payoutAccountId?: string): TransferJob {
		return {
			type: 'refund',
			request: {
				potId: pot.id,
				userId: pot.potterId,
				countryCode: pot.countryCode,
				currency: pot.currency,
				amountMinorUnits: refundAmountFor(pot.prizeAmountMinorUnits, reason),
				reason,
				originalReference: pot.fundingReference ?? '',
				...(payoutAccountId && { payoutAccountId }),
				idempotencyKey: `refund:${pot.id}`,
			},
		}
	}

	markRefunded(potId: string) {
		return this.transition({ id: potId, status: 'Cancelled' }, 'Refunded', SYSTEM_ACTOR, 'refund successful')
	}

	async create(
		userId: string,
		input: {
			eventId: string
			prizeAmountMinorUnits: number
			winnerCount: number
			refundAccountId: string
			isPrivate?: boolean
			callbackUrl?: string
		},
	) {
		if (input.winnerCount < MIN_WINNER_COUNT || input.winnerCount > MAX_WINNER_COUNT) {
			fail(400, `Winner count must be between ${MIN_WINNER_COUNT} and ${MAX_WINNER_COUNT}.`)
		}

		const user = await this.db.user.findUniqueOrThrow({ where: { id: userId } })
		assertCountrySupported(user.countryCode)
		const country = getCountryConfig(user.countryCode)!

		const event = await this.db.sportsEventCache.findUnique({ where: { id: input.eventId } })
		if (!event) fail(404, 'Match not found.')
		const sports = resolveSportsProviderForCountry(country.code)
		const leagueAllowed = !sports.leagues || sports.leagues.some((l) => l.code === event.league)
		if (event.provider !== sports.id || !leagueAllowed) fail(422, 'Match is not available in your country.')
		if (!isMatchBookable(event.status as MatchStatus, event.kickoffTimeUtc, new Date())) {
			fail(422, 'Match is no longer open for new pots.')
		}
		const refundAccount = await this.db.payoutAccount.findFirst({
			where: { id: input.refundAccountId, userId, deletedAt: null, countryCode: country.code },
			select: { id: true },
		})
		if (!refundAccount) fail(422, 'Choose a refund account from your saved bank accounts.')

		const pot = await this.db.pot.create({
			data: {
				id: crypto.randomUUID(),
				potterId: userId,
				eventId: input.eventId,
				countryCode: country.code,
				currency: country.currency,
				provider: country.paymentProviderId,
				prizeAmountMinorUnits: input.prizeAmountMinorUnits,
				winnerCount: input.winnerCount,
				refundAccountId: refundAccount.id,
				isPrivate: input.isPrivate ?? false,
			},
		})
		await this.db.potStateTransition.create({
			data: { potId: pot.id, toStatus: 'Draft', actorType: 'user', actorId: userId, reason: 'created' },
		})

		let callbackUrl = input.callbackUrl
		if (callbackUrl) {
			try {
				const url = new URL(callbackUrl)
				url.searchParams.set('verifyPotId', pot.id)
				callbackUrl = url.toString()
			} catch {
				// retain input.callbackUrl if not absolute URL
			}
		}

		const provider = createProviderRegistry(this.env).resolvePaymentProviderForCountry(pot.countryCode)
		let result: PaymentResult
		try {
			result = await provider.fund({
				potId: pot.id,
				userId,
				countryCode: pot.countryCode,
				currency: pot.currency,
				amountMinorUnits: pot.prizeAmountMinorUnits,
				idempotencyKey: `fund-${pot.id}`,
				...(callbackUrl && { callbackUrl }),
			})
		} catch (error) {
			await this.cancel(pot, SYSTEM_ACTOR, 'cancelled')
			log.error('fund', 'init_failed', { error })
			throw new HTTPException(502, { message: 'Payment provider is unavailable. Please try again later.' })
		}

		const withReference = { ...pot, fundingReference: result.reference }
		await this.db.pot.update({ where: { id: pot.id }, data: { fundingReference: result.reference } })
		await this.applyFundingResult(withReference, result, 1)
		return { pot: await this.getOwned(userId, pot.id), checkoutUrl: result.checkoutUrl }
	}

	/** Re-checks a pending funding with the provider and advances the pot. */
	async verifyFunding(userId: string, potId: string) {
		const pot = await this.getOwned(userId, potId)
		if (pot.status !== 'Draft') return pot
		if (!pot.fundingReference) fail(409, 'Funding was never initiated.')

		const provider = createProviderRegistry(this.env).resolvePaymentProviderForCountry(pot.countryCode)
		const result = await provider.verify({ reference: pot.fundingReference! })
		if (result.amountMinorUnits !== pot.prizeAmountMinorUnits || result.currency !== pot.currency) {
			fail(409, 'Funded amount does not match the pot prize.')
		}
		await this.applyFundingResult(pot, result, 2)
		return this.getOwned(userId, potId)
	}

	private async applyFundingResult(pot: Pot, result: PaymentResult, attempt: number) {
		if (result.status !== 'pending' || attempt === 1) {
			await this.ledger.append({
				type: 'fund',
				status: result.status,
				userId: pot.potterId,
				potId: pot.id,
				countryCode: pot.countryCode,
				currency: pot.currency,
				amountMinorUnits: pot.prizeAmountMinorUnits,
				provider: result.provider,
				idempotencyKey: `fund:${pot.id}`,
				attempt,
				reference: result.reference,
			})
		}

		if (result.status === 'failed') {
			await this.cancel(pot, SYSTEM_ACTOR, 'cancelled')
		} else if (result.status === 'successful') {
			// The share link only exists once funding has succeeded.
			const funded = await this.transition(pot, 'Funded', SYSTEM_ACTOR, 'funding confirmed', {
				shareCode: generateShareCode(),
			})
			if (!funded) return
			const fundedPot = { ...pot, status: 'Funded' }
			const event = await this.db.sportsEventCache.findUniqueOrThrow({ where: { id: pot.eventId } })
			if (isMatchBookable(event.status as MatchStatus, event.kickoffTimeUtc, new Date())) {
				await this.transition(fundedPot, 'Open', SYSTEM_ACTOR, 'funding confirmed')
			} else {
				await this.cancel(fundedPot, SYSTEM_ACTOR, 'cancelled')
			}
		}
	}

	async cancelByPotter(userId: string, potId: string) {
		const pot = await this.getOwned(userId, potId)
		const event = await this.db.sportsEventCache.findUniqueOrThrow({ where: { id: pot.eventId } })
		if (!['Draft', 'Funded', 'Open'].includes(pot.status) || !canPotterCancel(event.kickoffTimeUtc, new Date())) {
			fail(409, 'This pot can no longer be cancelled.')
		}
		await this.cancel(pot, { type: 'user', id: userId }, 'cancelled')
		return this.getOwned(userId, potId)
	}

	async getOwned(userId: string, potId: string) {
		const pot = await this.db.pot.findUnique({ where: { id: potId } })
		if (!pot) fail(404, 'Pot not found.')
		if (pot.potterId !== userId) fail(403, 'Not your pot.')
		return pot
	}

	/** Cron entry point (T6.8): advances every active pot as far as time and match status allow. */
	async syncStatuses(now = new Date()) {
		const pots = await this.db.pot.findMany({
			where: { status: { in: ACTIVE_STATUSES } },
			include: { event: true },
		})

		for (const { event, ...initial } of pots) {
			let pot: Pot = initial
			const snapshot = {
				kickoffTimeUtc: event.kickoffTimeUtc,
				status: event.status as MatchStatus,
				isFinalResultOfficial: event.isFinalResultOfficial,
			}
			for (let next = nextAutomaticTransition(pot.status as PotStatus, snapshot, now); next; ) {
				const moved =
					next.to === 'Cancelled'
						? await this.cancel(pot, SYSTEM_ACTOR, next.reason as RefundReason)
						: await this.transition(pot, next.to, SYSTEM_ACTOR, next.reason)
				if (!moved) break
				pot = { ...pot, status: next.to }
				next = nextAutomaticTransition(next.to, snapshot, now)
			}
		}
	}
}
