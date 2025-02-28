import type { UnixtimeMs } from '$lib/util/UnixtimeMs';

export type Range = {
	startTime: UnixtimeMs;
	endTime: UnixtimeMs;
};

export function split(range: Range, size: number): Array<Range> {
	let cells: Array<Range> = [];
	let prev = new Date(range.startTime);
	let t = new Date(range.startTime);
	t.setMinutes(t.getMinutes() + size);
	for (; t.getTime() <= range.endTime; t.setMinutes(t.getMinutes() + size)) {
		cells.push({ startTime: prev.getTime(), endTime: t.getTime() });
		prev = new Date(t);
	}
	return cells;
}
