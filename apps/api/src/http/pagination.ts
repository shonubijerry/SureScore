// One keyset-pagination implementation for every list endpoint (contract in
// @surescore/shared pagination): `limit` (default and maximum 1000) and an
// opaque `cursor`, answered with a `Page`. The cursor carries the sort-key
// values of the last row served, so the next batch is a plain range condition
// on an index (`(a, id) > (last.a, last.id)`), never an OFFSET that rescans
// skipped rows or drifts when rows are inserted.

import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { PAGE_FETCH_LIMIT, type Page } from "@surescore/shared";

export type { Page };
export const PAGE_DEFAULT = PAGE_FETCH_LIMIT;
export const PAGE_MAX = PAGE_FETCH_LIMIT;

export const pageQuery = {
	limit: z.coerce.number().int().min(1).max(PAGE_MAX).default(PAGE_DEFAULT),
	cursor: z.string().optional().describe("Opaque `nextCursor` from the previous page"),
};

export interface PageParams {
	limit?: number;
	cursor?: string;
}

/**
 * One column of a list's sort order. `path` may cross to-one relations
 * ("event.kickoffTimeUtc"). Columns must be non-null, and the last key of every
 * order must be unique (normally `id`) so each row has exactly one position.
 */
export interface SortKey {
	path: string;
	dir: "asc" | "desc";
	type?: "date" | "string" | "number";
}
export type SortOrder = readonly SortKey[];

/** Most lists: newest first, by creation time then id. */
export const newestFirst: SortOrder = [
	{ path: "createdAt", dir: "desc", type: "date" },
	{ path: "id", dir: "desc" },
];

// Prisma's per-model where/orderBy types can't be named generically; these
// fragments are only ever built here from a SortOrder and the caller's own where.
type Fragment = Record<string, any>;

export interface KeysetArgs<Where> {
	where: Where;
	orderBy: Fragment[];
	take: number;
}

/** `{ a: { b: value } }` for path "a.b". */
const nest = (path: string, value: unknown): Fragment =>
	path
		.split(".")
		.reduceRight<unknown>((inner, key) => ({ [key]: inner }), value) as Fragment;

const valueAt = (row: unknown, path: string) => path.split(".").reduce<unknown>((obj, key) => (obj as Fragment | null)?.[key], row);

const badCursor = (): never => {
	throw new HTTPException(400, { message: "Invalid cursor." });
};

export function encodeCursor(values: unknown[]): string {
	const json = JSON.stringify(values.map((v) => (v instanceof Date ? v.toISOString() : v)));
	const binary = String.fromCharCode(...new TextEncoder().encode(json));
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeCursor(cursor: string, order: SortOrder): unknown[] {
	let values: unknown;
	try {
		const binary = atob(cursor.replace(/-/g, "+").replace(/_/g, "/"));
		values = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0))));
	} catch {
		return badCursor();
	}
	if (!Array.isArray(values) || values.length !== order.length) return badCursor();
	return order.map(({ type = "string" }, i) => {
		const value = values[i];
		if (type === "date") {
			const date = typeof value === "string" ? new Date(value) : null;
			return date && !Number.isNaN(date.getTime()) ? date : badCursor();
		}
		return typeof value === type ? value : badCursor();
	});
}

/**
 * Rows strictly after `after` in `order`: for keys (a, b, id) that is
 * a > A, or a = A and b > B, or a = A and b = B and id > ID (with < for desc keys).
 */
function after(order: SortOrder, values: unknown[]): Fragment {
	return {
		OR: order.map((key, i) => ({
			AND: [
				...order.slice(0, i).map((prev, j) => nest(prev.path, values[j])),
				nest(key.path, { [key.dir === "asc" ? "gt" : "lt"]: values[i] }),
			],
		})),
	};
}

/** Prisma args for one batch: the caller's filter narrowed to rows after the cursor, plus one extra row to detect more. */
export function keysetArgs<Where extends object>(order: SortOrder, page: PageParams, where: Where): KeysetArgs<Where> & { limit: number } {
	const limit = Math.min(page.limit ?? PAGE_DEFAULT, PAGE_MAX);
	const filter = page.cursor ? ({ AND: [where, after(order, decodeCursor(page.cursor, order))] } as unknown as Where) : where;
	return { where: filter, orderBy: order.map((key) => nest(key.path, key.dir)), take: limit + 1, limit };
}

/** Trims a `keysetArgs` result to the page and derives the cursor from the last row kept. */
export function toPage<Row>(rows: Row[], order: SortOrder, limit: number): Page<Row> {
	if (rows.length <= limit) return { items: rows, nextCursor: null };
	const items = rows.slice(0, limit);
	const last = items[items.length - 1];
	return { items, nextCursor: encodeCursor(order.map((key) => valueAt(last, key.path))) };
}

/**
 * Reads one keyset page: `find` runs the model's findMany with the given args
 * (spread them in, adding include/select). Rows must carry every sort-key path.
 */
export async function paginate<Row, Where extends object>(
	order: SortOrder,
	page: PageParams,
	where: Where,
	find: (args: KeysetArgs<Where>) => Promise<Row[]>,
): Promise<Page<Row>> {
	const { limit, ...args } = keysetArgs(order, page, where);
	return toPage(await find(args), order, limit);
}

/** The same keyset contract over rows already in memory and sorted by `order` (e.g. a small fixed set). */
export function paginateArray<Row>(rows: readonly Row[], order: SortOrder, page: PageParams): Page<Row> {
	const limit = Math.min(page.limit ?? PAGE_DEFAULT, PAGE_MAX);
	const cursor = page.cursor ? decodeCursor(page.cursor, order) : null;
	const isAfter = (row: Row) => {
		for (const [i, key] of order.entries()) {
			const a = valueAt(row, key.path) as string | number | Date;
			const b = cursor![i] as string | number | Date;
			if (a < b) return key.dir === "desc";
			if (a > b) return key.dir === "asc";
		}
		return false;
	};
	const start = cursor ? rows.findIndex(isAfter) : 0;
	return toPage(start < 0 ? [] : rows.slice(start, start + limit + 1), order, limit);
}
