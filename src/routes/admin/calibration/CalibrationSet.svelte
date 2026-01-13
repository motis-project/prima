<script lang="ts">
	import type { CalibrationItinerary } from "$lib/calibration";
	import ItineraryList from "../../(customer)/routing/ItineraryList.svelte";

	let {
        name,
		itineraries
	}: {
		name: string;
        itineraries: Array<CalibrationItinerary>
	} = $props();
</script>