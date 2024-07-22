function getOrCreate<K, V>(map: Map<K, V>, key: K, valueFn: (key: K) => V): V {
	let value = map.get(key);
	if (value == undefined) {
		value = valueFn(key);
		map.set(key, value);
	}
	return value;
}

export function groupBy<T, K extends string | number | boolean, V>(
	array: T[],
	keyFn: (element: T) => K,
	valueFn: (element: T) => V
): Map<K, V[]> {
	const m = new Map<K, V[]>();
	array.forEach((element) => {
		getOrCreate(m, keyFn(element), () => {
			return new Array<V>();
		}).push(valueFn(element));
	});
	return m;
}

export function updateValues<K extends string | number | boolean, V>(
	map: Map<K, V>,
	updateFn: (v: V, k: K) => V
): void {
	[...map.entries()].forEach(([k, entry]) => map.set(k, updateFn(entry, k)));
}
