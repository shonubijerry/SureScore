import { z } from "zod";

/** Shared response shape for a PayoutAccount record. */
export const payoutAccountSchema = z.object({
	id: z.string(),
	userId: z.string(),
	countryCode: z.string(),
	provider: z.string(),
	accountName: z.string(),
	accountNumber: z.string(),
	bankCode: z.string().nullable(),
	isDefault: z.boolean(),
	isVerified: z.boolean(),
	deletedAt: z.iso.datetime().nullable().optional(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
});
