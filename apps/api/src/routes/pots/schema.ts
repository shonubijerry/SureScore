import { z } from "zod";
import { sportsEventSchema } from "../sports/schema.js";
import { MAX_WINNER_COUNT, MIN_WINNER_COUNT, potStatuses } from "@surescore/shared";

export const potSchema = z.object({
	id: z.string(),
	potterId: z.string(),
	eventId: z.string(),
	countryCode: z.string(),
	currency: z.string(),
	provider: z.string(),
	prizeAmountMinorUnits: z.number().int(),
	winnerCount: z.number().int().min(MIN_WINNER_COUNT).max(MAX_WINNER_COUNT),
	status: z.enum(potStatuses),
	fundingReference: z.string().nullable(),
	shareCode: z.string().nullable(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
});

export const potIdParams = z.object({ id: z.string() });

export const potResponse = (description: string, status: "200" | "201" = "200") => ({
	[status]: { description, content: { "application/json": { schema: z.object({ pot: potSchema }) } } },
});

/** Public-safe pot summary with its match (see lib/views.ts). */
export const potCardSchema = z.object({
	id: z.string(),
	status: z.enum(potStatuses),
	countryCode: z.string(),
	currency: z.string(),
	prizeAmountMinorUnits: z.number().int(),
	winnerCount: z.number().int(),
	shareCode: z.string().nullable(),
	predictionCount: z.number().int(),
	predictionLocksAt: z.iso.datetime(),
	createdAt: z.iso.datetime(),
	match: sportsEventSchema,
});
