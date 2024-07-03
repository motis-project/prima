export class Interval {
	start_time: Date;
	end_time: Date;

	constructor(start_time: Date, end_time: Date) {
		this.start_time = start_time;
		this.end_time = end_time;
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
}
