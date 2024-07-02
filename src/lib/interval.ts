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

	to_availability(id: number, vehicle: number) {
		return {
			start_time: this.start_time,
			end_time: this.end_time,
			vehicle: vehicle,
			id: id
		};
	}

	to_new_availability(vehicle: number) {
		return {
			start_time: this.start_time,
			end_time: this.end_time,
			vehicle: vehicle
		};
	}
}
