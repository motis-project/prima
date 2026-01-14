<script lang="ts">
	import type { CalibrationItinerary } from '$lib/calibration';
	import ItinerarySummary from '../../(customer)/routing/ItinerarySummary.svelte';
	

	let {
		id,
		name,
		itineraries
	}: {
		id: number;
		name: string;
		itineraries: Array<CalibrationItinerary>;
	} = $props();
</script>

{#snippet calibrationLabel(it: CalibrationItinerary)}
	<label>
		<input
			type="checkbox"
			name="required"
			bind:value={it.required}
		/>
		required
	</label>
	<label>
		<input
			type="checkbox"
			name="forbidden"
			bind:value={it.forbidden}
		/>
		forbidden
	</label>
{/snippet}

<div class="flex flex-row rounded-md border-2 border-solid p-2">
	<div class="flex flex-col">
		{name}
		{#each itineraries as it}
			
		{/each}
	</div>
</div>
