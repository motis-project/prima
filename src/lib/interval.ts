export class Interval {
	start_time: Date;
	end_time: Date;

	constructor(start_time: Date, end_time: Date) {
		this.start_time = start_time;
		this.end_time = end_time;
	}

	overlaps(other: Interval) {
		return this.start_time < other.end_time && this.end_time > other.start_time;
	}

	touches(other: Interval) {
		return (
			this.start_time.getTime() == other.end_time.getTime() ||
			this.end_time.getTime() == other.start_time.getTime()
		);
	}

	contains(other: Interval) {
		return this.start_time <= other.start_time && other.end_time <= this.end_time;
	}

	cut(cutter: Interval): Interval {
		if (this.start_time < cutter.start_time) {
			return new Interval(this.start_time, cutter.start_time);
		} else {
			return new Interval(cutter.end_time, this.end_time);
		}
	}

	split(splitter: Interval) {
		return [
			new Interval(this.start_time, splitter.start_time),
			new Interval(splitter.end_time, this.end_time)
		];
	}

	merge(overlapping: Interval) {
		return new Interval(
			new Date(Math.min(this.start_time.getTime(), overlapping.start_time.getTime())),
			new Date(Math.max(this.end_time.getTime(), overlapping.end_time.getTime()))
		);
	}

	equals(other: Interval) {
		return (
			this.start_time.getTime() == other.start_time.getTime() &&
			this.end_time.getTime() == other.end_time.getTime()
		);
	}

	expand(prepone_start: number, postpone_end: number) {
		return new Interval(
			new Date(this.start_time.getTime() - prepone_start),
			new Date(this.end_time.getTime() + postpone_end)
		);
	}

	isMergeable(other: Interval): boolean {
		return this.overlaps(other) || this.touches(other);
	}

	static merge = (unmerged: Interval[]): Interval[] => {
		if (unmerged.length == 0) {
			return new Array<Interval>();
		}
		unmerged.sort((i1, i2) => i1.start_time.getTime() - i2.start_time.getTime());
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
