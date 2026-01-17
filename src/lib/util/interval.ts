import type { UnixtimeMs } from '$lib/util/UnixtimeMs';

export enum INTERVAL_RELATION {
	EQUAL,
	A_CONTAINS_B,
	B_CONTAINS_A,
	OVERLAPPING_A_EARLIER,
	OVERLAPPING_B_EARLIER,
	A_BEFORE_B,
	B_BEFORE_A,
	TOUCH_A_BEFORE_B,
	TOUCH_B_BEFORE_A
}

export type IntervalLike = {
	startTime: number;
	endTime: number;
};

export class Interval {
	startTime: number;
	endTime: number;

	constructor(startTime: number | IntervalLike, endTime?: number) {
		if (typeof startTime === 'number') {
			this.startTime = startTime;
			this.endTime = endTime!;
		} else {
			this.startTime = startTime.startTime!;
			this.endTime = startTime.endTime!;
		}
	}

	size() {
		return this.endTime - this.startTime;
	}

	overlaps(other: Interval) {
		return this.startTime < other.endTime && this.endTime > other.startTime;
	}

	touches(other: Interval) {
		return this.startTime == other.endTime || this.endTime == other.startTime;
	}

	noDistanceBetween(other: Interval) {
		return other.overlaps(this) || other.touches(this) || other.equals(this);
	}

	eitherEndIsEqual(other: Interval) {
		return this.startTime == other.startTime || this.endTime == other.endTime;
	}

	contains(other: Interval) {
		return this.startTime <= other.startTime && other.endTime <= this.endTime;
	}

	cut(cutter: Interval): Interval {
		if (this.startTime < cutter.startTime) {
			return new Interval(this.startTime, cutter.startTime);
		} else {
			return new Interval(cutter.endTime, this.endTime);
		}
	}

	split(splitter: Interval) {
		return [
			new Interval(this.startTime, splitter.startTime),
			new Interval(splitter.endTime, this.endTime)
		];
	}

	merge(overlapping: Interval) {
		return new Interval(
			Math.min(this.startTime, overlapping.startTime),
			Math.max(this.endTime, overlapping.endTime)
		);
	}

	equals(other: Interval) {
		return this.startTime == other.startTime && this.endTime == other.endTime;
	}

	expand(preponeStart: number, postponeEnd: number) {
		return new Interval(this.startTime - preponeStart, this.endTime + postponeEnd);
	}

	shrink(postponeStart: number, preponeEnd: number) {
		if (this.getDurationMs() < postponeStart + preponeEnd) {
			return undefined;
		}
		return new Interval(this.startTime + postponeStart, this.endTime - preponeEnd);
	}

	isMergeable(other: Interval): boolean {
		return this.overlaps(other) || this.touches(other);
	}

	getDurationMs() {
		return this.endTime - this.startTime;
	}

	covers(time: UnixtimeMs): boolean {
		return this.startTime <= time && this.endTime >= time;
	}

	intersect(other: Interval): Interval | undefined {
		if (this.overlaps(other)) {
			return new Interval(
				Math.max(this.startTime, other.startTime),
				Math.min(this.endTime, other.endTime)
			);
		}
		return undefined;
	}

	shift(x: number): Interval {
		return new Interval(this.startTime + x, this.endTime + x);
	}

	static intersect(a: Interval[], b: Interval[]): Interval[] {
		a.sort((i1, i2) => i1.startTime - i2.startTime);
		b.sort((i1, i2) => i1.startTime - i2.startTime);
		const ret: Interval[] = [];
		let aPos = 0;
		let bPos = 0;
		let aCurrent = a[aPos];
		let bCurrent = b[bPos];
		const maxIterations = a.length + b.length + 10;
		let i = 0;
		while (aPos != a.length && bPos != b.length) {
			if (++i > maxIterations) {
				throw 'subtract error';
			}
			switch (aCurrent.getRelation(bCurrent)) {
				case INTERVAL_RELATION.EQUAL: {
					ret.push(bCurrent);
					aCurrent = a[++aPos];
					bCurrent = b[++bPos];
					break;
				}

				case INTERVAL_RELATION.TOUCH_B_BEFORE_A: {
					bCurrent = b[++bPos];
					break;
				}

				case INTERVAL_RELATION.TOUCH_A_BEFORE_B: {
					aCurrent = a[++aPos];
					break;
				}

				case INTERVAL_RELATION.B_BEFORE_A: {
					bCurrent = b[++bPos];
					break;
				}

				case INTERVAL_RELATION.A_BEFORE_B: {
					aCurrent = a[++aPos];
					break;
				}

				case INTERVAL_RELATION.A_CONTAINS_B: {
					ret.push(bCurrent);
					bCurrent = b[++bPos];
					break;
				}

				case INTERVAL_RELATION.B_CONTAINS_A: {
					ret.push(aCurrent);
					aCurrent = a[++aPos];
					break;
				}

				case INTERVAL_RELATION.OVERLAPPING_B_EARLIER: {
					ret.push(new Interval(aCurrent.startTime, bCurrent.endTime));
					bCurrent = b[++bPos];
					break;
				}

				case INTERVAL_RELATION.OVERLAPPING_A_EARLIER: {
					ret.push(new Interval(bCurrent.startTime, aCurrent.endTime));
					aCurrent = a[++aPos];
					break;
				}

				default:
					break;
			}
		}
		return ret;
	}

	static subtract(minuend: Interval[], subtrahend: Interval[]): Interval[] {
		subtrahend.sort((s1, s2) => s1.startTime - s2.startTime);
		minuend.sort((m1, m2) => m1.startTime - m2.startTime);
		let minuendPos = 0;
		let subtrahendPos = 0;
		let ret: Interval[] = [];
		let currentMinuend = minuend[minuendPos];
		let currentSubtrahend = subtrahend[subtrahendPos];
		const maxIterations = minuend.length + subtrahend.length + 10;
		let i = 0;
		while (minuendPos != minuend.length && subtrahendPos != subtrahend.length) {
			if (++i > maxIterations) {
				throw 'subtract error';
			}
			switch (currentMinuend.getRelation(currentSubtrahend)) {
				case INTERVAL_RELATION.EQUAL: {
					currentSubtrahend = subtrahend[++subtrahendPos];
					currentMinuend = minuend[++minuendPos];
					break;
				}

				case INTERVAL_RELATION.TOUCH_B_BEFORE_A: {
					currentSubtrahend = subtrahend[++subtrahendPos];
					break;
				}

				case INTERVAL_RELATION.TOUCH_A_BEFORE_B: {
					ret.push(currentMinuend);
					currentMinuend = minuend[++minuendPos];
					break;
				}

				case INTERVAL_RELATION.B_BEFORE_A: {
					currentSubtrahend = subtrahend[++subtrahendPos];
					break;
				}

				case INTERVAL_RELATION.A_BEFORE_B: {
					ret.push(currentMinuend);
					currentMinuend = minuend[++minuendPos];
					break;
				}

				case INTERVAL_RELATION.A_CONTAINS_B: {
					const splitResult = currentMinuend.split(currentSubtrahend);
					if (splitResult[0].startTime < splitResult[0].endTime) {
						ret.push(splitResult[0]);
					}
					currentMinuend =
						splitResult[1].startTime < splitResult[1].endTime
							? splitResult[1]
							: minuend[++minuendPos];
					currentSubtrahend = subtrahend[++subtrahendPos];
					break;
				}

				case INTERVAL_RELATION.B_CONTAINS_A: {
					currentMinuend = minuend[++minuendPos];
					break;
				}

				case INTERVAL_RELATION.OVERLAPPING_B_EARLIER: {
					const cutResult = currentMinuend.cut(currentSubtrahend);
					currentMinuend = cutResult;
					currentSubtrahend = subtrahend[++subtrahendPos];
					break;
				}

				case INTERVAL_RELATION.OVERLAPPING_A_EARLIER: {
					const cutResult = currentMinuend.cut(currentSubtrahend);
					ret.push(cutResult);
					currentMinuend = minuend[++minuendPos];
					break;
				}

				default:
					break;
			}
		}
		if (minuendPos != minuend.length) {
			ret.push(currentMinuend);
			ret = ret.concat(minuend.slice(++minuendPos));
		}
		return ret;
	}

	getRelation(other: Interval): INTERVAL_RELATION {
		if (other.startTime == this.startTime && other.endTime == this.endTime) {
			return INTERVAL_RELATION.EQUAL;
		}
		if (other.contains(this)) {
			return INTERVAL_RELATION.B_CONTAINS_A;
		}
		if (this.contains(other)) {
			return INTERVAL_RELATION.A_CONTAINS_B;
		}
		if (this.overlaps(other)) {
			return this.startTime > other.startTime
				? INTERVAL_RELATION.OVERLAPPING_B_EARLIER
				: INTERVAL_RELATION.OVERLAPPING_A_EARLIER;
		}
		if (this.touches(other)) {
			return this.startTime > other.startTime
				? INTERVAL_RELATION.TOUCH_B_BEFORE_A
				: INTERVAL_RELATION.TOUCH_A_BEFORE_B;
		}
		return this.startTime > other.startTime
			? INTERVAL_RELATION.B_BEFORE_A
			: INTERVAL_RELATION.A_BEFORE_B;
	}

	public toString = (): string => {
		return `[${new Date(this.startTime).toISOString()} - ${new Date(this.endTime).toISOString()}]`;
	};

	static merge = (unmerged: Interval[]): Interval[] => {
		if (unmerged.length == 0) {
			return new Array<Interval>();
		}
		unmerged.sort((i1, i2) => i1.startTime - i2.startTime);
		const merged = new Array<Interval>();
		for (let i = 1; i < unmerged.length; ++i) {
			const previous = unmerged[i - 1];
			const current = unmerged[i];
			if (previous.isMergeable(current)) {
				unmerged[i] = previous.merge(current);
				continue;
			}
			merged.push(previous);
		}
		merged.push(unmerged.pop()!);
		return merged;
	};
}

export const covers = (a: IntervalLike, b: UnixtimeMs) => new Interval(a).covers(b);
