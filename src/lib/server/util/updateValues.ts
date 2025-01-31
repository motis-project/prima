export function updateValues<K extends string | number | boolean, V>(
	map: Map<K, V>,
	updateFn: (v: V, k: K) => V
): void {
	[...map.entries()].forEach(([k, entry]) => map.set(k, updateFn(entry, k)));
}
