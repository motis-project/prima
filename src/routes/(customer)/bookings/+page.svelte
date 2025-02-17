<script lang="ts">
	import ItinerarySummary from '../routing/ItinerarySummary.svelte';

	const { data } = $props();
</script>

<div class="flex flex-col gap-4">
	{#each data.journeys as it}
		<a href="/bookings/{it.id}"> <ItinerarySummary it={it.journey} /></a>
	{/each}
</div>
