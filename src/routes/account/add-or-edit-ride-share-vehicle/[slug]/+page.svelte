<script lang="ts">
	import AddOrEditRideShareVehicle from '$lib/ui/AddOrEditRideShareVehicle.svelte';

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
></AddOrEditRideShareVehicle>
