import { z } from "zod";
import type { User } from "@surescore/db";

/** E.164 mobile number, e.g. "+2348012345678"; the country's format is checked by the service. */
export const phoneSchema = z.string().trim().regex(/^\+\d{8,15}$/, "Use international format, e.g. +2348012345678.");

/** Sign-in id: trimmed and lowercased before validation, and stored that way. */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.").max(254));

export const otpCodeSchema = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code.");

export const fullNameSchema = z.string().trim().min(2).max(100);

export const userResponseSchema = z.object({
	id: z.string(),
	phone: z.string().nullable(),
	email: z.string().nullable(),
	countryCode: z.string(),
	displayName: z.string().nullable(),
	role: z.string(),
});

export const sessionResponseSchema = z.object({ token: z.string(), expiresAt: z.iso.datetime(), user: userResponseSchema });

export const otpChallengeSchema = z.object({
	sentTo: z.string().describe("Where the code was sent"),
	expiresAt: z.iso.datetime(),
	resendAvailableAt: z.iso.datetime(),
});

export const userView = (user: User): z.infer<typeof userResponseSchema> => ({
	id: user.id,
	phone: user.phone,
	email: user.email,
	countryCode: user.countryCode,
	displayName: user.displayName,
	role: user.role,
});
