export class Interval {
	startTime: Date;
	endTime: Date;

	constructor(startTime: Date, endTime: Date) {
		this.startTime = startTime;
		this.endTime = endTime;
	}

	overlaps(other: Interval) {
		return this.startTime < other.endTime && this.endTime > other.startTime;
	}

	touches(other: Interval) {
		return (
			this.startTime.getTime() == other.endTime.getTime() ||
			this.endTime.getTime() == other.startTime.getTime()
		);
	}

	eitherEndIsEqual(other: Interval) {
		return (
			this.startTime.getTime() == other.startTime.getTime() ||
			this.endTime.getTime() == other.endTime.getTime()
		);
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
			new Date(Math.min(this.startTime.getTime(), overlapping.startTime.getTime())),
			new Date(Math.max(this.endTime.getTime(), overlapping.endTime.getTime()))
		);
	}

	equals(other: Interval) {
		return (
			this.startTime.getTime() == other.startTime.getTime() &&
			this.endTime.getTime() == other.endTime.getTime()
		);
	}

	expand(preponeStart: number, postponeEnd: number) {
		return new Interval(
			new Date(this.startTime.getTime() - preponeStart),
			new Date(this.endTime.getTime() + postponeEnd)
		);
	}

	shrink(postponeStart: number, preponeEnd: number) {
		return new Interval(
			new Date(this.startTime.getTime() + postponeStart),
			new Date(this.endTime.getTime() - preponeEnd)
		);
	}

	isMergeable(other: Interval): boolean {
		return this.overlaps(other) || this.touches(other);
	}

	getDurationMs() {
		return this.endTime.getTime() - this.startTime.getTime();
	}

	static merge = (unmerged: Interval[]): Interval[] => {
		if (unmerged.length == 0) {
			return new Array<Interval>();
		}
		unmerged.sort((i1, i2) => i1.startTime.getTime() - i2.startTime.getTime());
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

	intersect(other: Interval): Interval | undefined {
		if (this.overlaps(other)) {
			return new Interval(
				new Date(Math.max(this.startTime.getTime(), other.startTime.getTime())),
				new Date(Math.min(this.endTime.getTime(), other.endTime.getTime()))
			);
		}
		return undefined;
	}

	covers(time: Date): boolean {
		return this.startTime <= time && this.endTime >= time;
	}
}
