// D1 caps bound parameters per statement (100), so `in` lists are queried in chunks.
const D1_IN_LIMIT = 90;

export async function inChunks<K, R>(values: readonly K[], query: (chunk: K[]) => Promise<R[]>): Promise<R[]> {
	const results: R[] = [];
	for (let i = 0; i < values.length; i += D1_IN_LIMIT) {
		results.push(...(await query(values.slice(i, i + D1_IN_LIMIT))));
	}
	return results;
}
