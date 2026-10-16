// One pagination contract for every list in the app. The client asks the API
// for up to PAGE_FETCH_LIMIT rows at a time and shows them PAGE_VIEW_SIZE per
// page; "Load more" fetches the next batch with the opaque keyset cursor the
// previous batch returned (never an offset).

/** Rows per API request: the default and the maximum `limit`. */
export const PAGE_FETCH_LIMIT = 1000;

/** Rows per page on screen, within the batches already loaded. */
export const PAGE_VIEW_SIZE = 50;

/** A batch of rows; `nextCursor` is null on the last one. */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** A `Page` whose rows sit under a resource name, e.g. `{ pots, nextCursor }`. */
export type KeyedPage<K extends string, T> = { [P in K]: T[] } & { nextCursor: string | null };

export const pageCount = (total: number, size = PAGE_VIEW_SIZE) => Math.max(1, Math.ceil(total / size));

/** The rows on 0-based screen page `page`. */
export const pageSlice = <T>(items: readonly T[], page: number, size = PAGE_VIEW_SIZE) => items.slice(page * size, (page + 1) * size);
