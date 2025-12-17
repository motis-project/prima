<script lang="ts">
	import AddOrEditRideShareVehicle from '$lib/ui/AddOrEditRideShareVehicle.svelte';
	import type {CountryKey} from '@codecorn/euro-plate-validator';

	const { form, data } = $props();
</script>

<AddOrEditRideShareVehicle
	{form}
	luggage={data.luggage}
	passengers={data.passengers}
	vehiclePicturePath={data.picture}
	licensePlate={data.licensePlate}
	smokingAllowed={data.smokingAllowed}
	color={data.color}
	model={data.model}
	vehicleId={data.id}
	country={data.country as CountryKey}
></AddOrEditRideShareVehicle>
