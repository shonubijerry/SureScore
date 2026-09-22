import { contentJson } from "chanfana";
import { z } from "zod";

export const errorSchema = z.object({ error: z.string() });

/** A standard `{ error: string }` JSON response entry for a chanfana `responses` map. */
export function errorResponse(description: string) {
	return { description, ...contentJson(errorSchema) };
}
