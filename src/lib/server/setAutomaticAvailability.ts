import { db } from '$lib/server/db';

export async function setAutomaticAvailability(
	companyId: number,
	vehicleId: number,
	enabled: boolean
): Promise<'ok' | 'vehicleNotFound' | 'lastVehicle'> {
	return db.transaction().execute(async (trx) => {
		const vehicles = await trx
			.selectFrom('vehicle')
			.select(['id', 'setAutomaticAvailability'])
			.where('company', '=', companyId)
			.execute();
		if (!vehicles.some((v) => v.id === vehicleId)) {
			return 'vehicleNotFound';
		}
		if (!enabled && !vehicles.some((v) => v.id !== vehicleId && v.setAutomaticAvailability)) {
			return 'lastVehicle';
		}
		await trx
			.updateTable('vehicle')
			.set({ setAutomaticAvailability: enabled })
			.where('id', '=', vehicleId)
			.execute();
		return 'ok';
	});
}
