import { contentJson } from "chanfana";
import { z } from "zod";

/** Every admin mutation records who did it and why; the reason is never optional. */
export const reasonSchema = z.string().trim().min(5, "A reason of at least 5 characters is required.").max(500);

export const potIdParams = z.object({ id: z.string() });

export const okResponse = (description: string) => ({ "200": { description, ...contentJson(z.any()) } });
