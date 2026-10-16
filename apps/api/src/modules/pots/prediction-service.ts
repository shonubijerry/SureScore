// Prediction submission and leaderboards. Scoring/ranking rules are pure and
// live in @surescore/shared (scoring); this module enforces pot-state rules
// (pre-lock, one per user, country + payout eligibility) and applies them to storage.

import { HTTPException } from "hono/http-exception";
import { createDbClient, type Pot, type Prediction, type SportsEventCache } from "@surescore/db";
import { assertPotAccess } from "./pot-access.js";
import { paginate, type PageParams, type SortOrder } from "../../http/pagination.js";
import {
	assertHasCompletedPayoutDetails,
	DEFAULT_TIE_BREAKS,
	assertSameCountryEligibility,
	EligibilityError,
	isPredictionLocked,
	predictionLockTime,
	rankPredictions,
	scorePrediction,
	type MatchOutcome,
	type TieBreakName,
} from "@surescore/shared";

export interface PredictionInput {
	homeGoals: number;
	awayGoals: number;
	firstGoalMinute?: number | null;
}

type Outcome = { actual: MatchOutcome; final: boolean } | null;

/** Entry order: ids are cuids, so this is roughly submission order and served by the (potId, id) index. */
const byId: SortOrder = [{ path: "id", dir: "asc" }];

const fail = (status: 400 | 403 | 404 | 409, message: string): never => {
	throw new HTTPException(status, { message });
};

const pick = (p: Pick<Prediction, "homeGoals" | "awayGoals" | "firstGoalMinute">) => ({
	home: p.homeGoals,
	away: p.awayGoals,
	firstGoalMinute: p.firstGoalMinute,
});

/** Scoreable once the provider reports a scoreline; `final` marks the official result. */
function outcomeOf(event: SportsEventCache): Outcome {
	if (event.homeScore == null || event.awayScore == null) return null;
	return {
		actual: {
			home: event.homeScore,
			away: event.awayScore,
			firstGoalMinute: event.firstGoalMinute,
			underdog: event.underdog as MatchOutcome["underdog"],
		},
		final: event.isFinalResultOfficial,
	};
}

export class PredictionService {
	private readonly db;

	constructor(
		env: Env,
		private readonly tieBreaks: readonly TieBreakName[] = DEFAULT_TIE_BREAKS,
	) {
		this.db = createDbClient(env.DB);
	}

	/** `shareCode` is required for a private pot the user can't otherwise reach. */
	async submit(userId: string, potId: string, input: PredictionInput, now = new Date(), shareCode?: string) {
		const pot = await this.getOpenPot(potId, now);
		await assertPotAccess(this.db, pot, { userId, shareCode });
		await this.assertEligible(userId, pot);

		try {
			const created = await this.db.prediction.create({ data: { potId, userId, ...this.values(input) } });
			return this.view(created, null);
		} catch (error) {
			// The unique (potId, userId) index is the source of truth for "one per user".
			if ((error as { code?: string }).code === "P2002") fail(409, "You already predicted this pot; edit it instead.");
			throw error;
		}
	}

	/** Pre-lock edit; the replaced values are appended to the edit history in the same batch. */
	async edit(userId: string, potId: string, input: PredictionInput, now = new Date()) {
		await this.getOpenPot(potId, now);
		const current = await this.db.prediction.findUnique({ where: { potId_userId: { potId, userId } } });
		if (!current) return fail(404, "You have not predicted this pot yet.");

		const next = this.values(input);
		if (
			next.homeGoals === current.homeGoals &&
			next.awayGoals === current.awayGoals &&
			next.firstGoalMinute === current.firstGoalMinute
		) {
			return this.view(current, null);
		}

		const [, updated] = await this.db.$transaction([
			this.db.predictionEdit.create({
				data: {
					predictionId: current.id,
					homeGoals: current.homeGoals,
					awayGoals: current.awayGoals,
					firstGoalMinute: current.firstGoalMinute,
				},
			}),
			this.db.prediction.update({ where: { id: current.id }, data: next }),
		]);
		return this.view(updated, null);
	}

	/** The caller's own prediction with score breakdown (provisional until the result is official) and edit history. */
	async getMine(userId: string, potId: string) {
		const found = await this.db.prediction.findUnique({
			where: { potId_userId: { potId, userId } },
			include: { edits: { orderBy: { replacedAt: "asc" } }, pot: { include: { event: true } } },
		});
		if (!found) {
			return {
				prediction: null,
				final: false,
				breakdown: null,
				edits: [],
			};
		}

		const { pot, edits, ...prediction } = found;
		return this.view(prediction, outcomeOf(pot.event), edits);
	}

	/** Ranked leaderboard; hidden until the prediction lock so picks cannot be copied. */
	async leaderboard(potId: string, viewer: { userId?: string; shareCode?: string } = {}, now = new Date()) {
		const pot = await this.db.pot.findUnique({ where: { id: potId }, include: { event: true } });
		if (!pot) return fail(404, "Pot not found.");
		await assertPotAccess(this.db, pot, viewer);
		if (!isPredictionLocked(pot.event.kickoffTimeUtc, now)) {
			fail(403, "The leaderboard is hidden until predictions lock.");
		}

		const outcome = outcomeOf(pot.event);
		const predictions = await this.db.prediction.findMany({
			where: { potId },
			include: { user: { select: { displayName: true } } },
			orderBy: { createdAt: "asc" },
		});

		const entries = predictions.map(({ user, ...prediction }) => ({
			item: { displayName: user.displayName, prediction },
			pick: pick(prediction),
		}));

		// No scoreline yet: everyone is level, so list the picks unranked.
		const ranked = outcome
			? rankPredictions(entries, outcome.actual, { tieBreaks: this.tieBreaks })
			: entries.map(({ item }) => ({ rank: 1, item, breakdown: null }));

		return {
			potId,
			final: outcome?.final ?? false,
			entries: ranked.map(({ rank, item, breakdown }) => ({
				rank,
				userId: item.prediction.userId,
				displayName: item.displayName,
				homeGoals: item.prediction.homeGoals,
				awayGoals: item.prediction.awayGoals,
				firstGoalMinute: item.prediction.firstGoalMinute,
				submittedAt: item.prediction.createdAt.toISOString(),
				breakdown,
			})),
		};
	}

	/**
	 * Everyone who has predicted, oldest first, one keyset page at a time (`id > last id` on the
	 * (potId, id) index, so D1 reads only the page's rows). This is the leaderboard before lock,
	 * when nothing is ranked yet; picks stay null until the prediction lock so they cannot be copied.
	 */
	async entrants(potId: string, viewer: { userId?: string; shareCode?: string }, page: PageParams = {}, now = new Date()) {
		const pot = await this.db.pot.findUnique({ where: { id: potId }, include: { event: { select: { kickoffTimeUtc: true } } } });
		if (!pot) return fail(404, "Pot not found.");
		await assertPotAccess(this.db, pot, viewer);

		const revealed = isPredictionLocked(pot.event.kickoffTimeUtc, now);
		const { items, nextCursor } = await paginate(byId, page, { potId }, (args) =>
			this.db.prediction.findMany({ ...args, include: { user: { select: { displayName: true } } } }),
		);

		return {
			revealed,
			nextCursor,
			predictions: items.map(({ id, userId, createdAt, user, homeGoals, awayGoals, firstGoalMinute }) => ({
				id,
				userId,
				displayName: user.displayName,
				submittedAt: createdAt.toISOString(),
				...(revealed ? { homeGoals, awayGoals, firstGoalMinute } : { homeGoals: null, awayGoals: null, firstGoalMinute: null }),
			})),
		};
	}

	/** A 0-0 pick has no first goal, so any minute is dropped. */
	private values({ homeGoals, awayGoals, firstGoalMinute }: PredictionInput) {
		return { homeGoals, awayGoals, firstGoalMinute: firstGoalMinute ?? null };
	}

	private view(
		prediction: Prediction,
		outcome: Outcome,
		edits: { homeGoals: number; awayGoals: number; firstGoalMinute: number | null; replacedAt: Date }[] = [],
	) {
		return {
			prediction,
			final: outcome?.final ?? false,
			breakdown: outcome ? scorePrediction(pick(prediction), outcome.actual) : null,
			edits,
		};
	}

	private async getOpenPot(potId: string, now: Date): Promise<Pot> {
		const found = await this.db.pot.findUnique({ where: { id: potId }, include: { event: true } });
		if (!found) return fail(404, "Pot not found.");
		const { event, ...pot } = found;
		// Time is checked as well as status because the status sync only runs on a schedule.
		if (pot.status !== "Open" || isPredictionLocked(event.kickoffTimeUtc, now)) {
			fail(409, `Predictions are closed for this pot (lock: ${predictionLockTime(event.kickoffTimeUtc).toISOString()}).`);
		}
		return pot;
	}

	private async assertEligible(userId: string, pot: Pot) {
		const user = await this.db.user.findUniqueOrThrow({
			where: { id: userId },
			include: { payoutAccounts: { where: { deletedAt: null } } },
		});
		try {
			assertSameCountryEligibility(user.countryCode, pot.countryCode);
			assertHasCompletedPayoutDetails(user.countryCode, user.payoutAccounts);
		} catch (error) {
			if (error instanceof EligibilityError) fail(403, error.message);
			throw error;
		}
	}
}
