// One cursor-pagination contract for every list endpoint: `limit` (default
// and maximum 1000) and an opaque `cursor`, answered with `{ items, nextCursor }`.

import { z } from "zod";

export const PAGE_DEFAULT = 1000;
export const PAGE_MAX = 1000;

export const pageQuery = {
	limit: z.coerce.number().int().min(1).max(PAGE_MAX).default(PAGE_DEFAULT),
	cursor: z.string().optional(),
};

export interface Page<T> {
	items: T[];
	nextCursor: string | null;
}

export interface PageParams {
	limit?: number;
	cursor?: string;
}

/** Prisma args for a page: one extra row is read to learn whether another page exists. */
export const pageArgs = ({ limit = PAGE_DEFAULT, cursor }: PageParams = {}) => ({
	take: Math.min(limit, PAGE_MAX) + 1,
	...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
});

/** Trims a `pageArgs` result to a page and derives the cursor from the last kept row. */
export function toPage<T extends { id: string }>(rows: T[], limit: number = PAGE_DEFAULT): Page<T> {
	const size = Math.min(limit, PAGE_MAX);
	return rows.length > size ? { items: rows.slice(0, size), nextCursor: rows[size - 1].id } : { items: rows, nextCursor: null };
}
