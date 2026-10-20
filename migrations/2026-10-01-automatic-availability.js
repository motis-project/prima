const DAY = 24 * 60 * 60 * 1000;

function mergedDuration(intervals) {
	const sorted = intervals
		.map(({ startTime, endTime }) => ({ startTime, endTime }))
		.sort((a, b) => a.startTime - b.startTime);

	let duration = 0;
	let current;
	for (const interval of sorted) {
		if (current === undefined) {
			current = interval;
		} else if (interval.startTime <= current.endTime) {
			current.endTime = Math.max(current.endTime, interval.endTime);
		} else {
			duration += current.endTime - current.startTime;
			current = interval;
		}
	}

	if (current !== undefined) {
		duration += current.endTime - current.startTime;
	}

	return duration;
}

export async function up(db) {
	await db.schema
		.alterTable('vehicle')
		.addColumn('set_automatic_availability', 'boolean', (column) =>
			column.notNull().defaultTo(false)
		)
		.execute();

	const cutoff = Date.now() - 28 * DAY;
	const [vehicles, availabilities] = await Promise.all([
		db.selectFrom('vehicle').select(['vehicle.id', 'vehicle.company']).execute(),
		db
			.selectFrom('availability')
			.select([
				'availability.vehicle',
				'availability.start_time as startTime',
				'availability.end_time as endTime'
			])
			.where('availability.end_time', '>', cutoff)
			.execute()
	]);

	const intervalsByVehicle = new Map();
	for (const availability of availabilities) {
		const intervals = intervalsByVehicle.get(availability.vehicle) ?? [];
		intervals.push({
			startTime: Math.max(availability.startTime, cutoff),
			endTime: availability.endTime
		});
		intervalsByVehicle.set(availability.vehicle, intervals);
	}

	const selectedByCompany = new Map();
	for (const vehicle of vehicles) {
		const score = mergedDuration(intervalsByVehicle.get(vehicle.id) ?? []);
		console.log({score})
		const selected = selectedByCompany.get(vehicle.company);
		if (
			selected === undefined ||
			score > selected.score ||
			(score === selected.score && vehicle.id < selected.vehicleId)
		) {
			selectedByCompany.set(vehicle.company, { vehicleId: vehicle.id, score });
		}
	}

	for (const { vehicleId } of selectedByCompany.values()) {
		await db
			.updateTable('vehicle')
			.set({ set_automatic_availability: true })
			.where('vehicle.id', '=', vehicleId)
			.execute();
	}
}

export async function down(db) {
	await db.schema.alterTable('vehicle').dropColumn('set_automatic_availability').execute();
}
