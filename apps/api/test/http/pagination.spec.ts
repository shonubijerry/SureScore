import { describe, expect, it } from "vitest";
import { PAGE_MAX, toPage } from "../../src/http/pagination";

describe("pagination", () => {
	it("defaults to 1000 and reports a cursor only when more rows exist", () => {
		expect(PAGE_MAX).toBe(1000);
		const rows = Array.from({ length: 4 }, (_, i) => ({ id: String(i) }));
		expect(toPage(rows, 3)).toEqual({ items: rows.slice(0, 3), nextCursor: "2" });
		expect(toPage(rows.slice(0, 3), 3).nextCursor).toBeNull();
		expect(toPage(rows).items).toHaveLength(4);
	});
});
