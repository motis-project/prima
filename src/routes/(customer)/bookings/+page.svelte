<script lang="ts">
	import Alert from 'lucide-svelte/icons/triangle-alert';
	import ItinerarySummary from '../routing/ItinerarySummary.svelte';
	import { t } from '$lib/i18n/translation';
	import type { Itinerary } from '$lib/openapi';

	const { data } = $props();
	const pastJourneys = data.journeys.filter(
		(j) => j.cancelled || new Date(j.journey.endTime).getTime() < Date.now()
	);
	const plannedJourneys = data.journeys.filter(
		(j) => !j.cancelled && new Date(j.journey.endTime).getTime() >= Date.now()
	);
</script>

{#snippet cancelled()}
	<Alert class="size-4" />
	{t.msg.cancelled}
{/snippet}

{#snippet journeyList(
	journeys: {
		journey: Itinerary;
		id: number;
		ticketCode: string | null;
		cancelled: boolean | null;
	}[]
)}
	<div class="flex flex-col gap-4">
		{#each journeys as it}
			<a href="/bookings/{it.id}">
				<ItinerarySummary
					it={it.journey}
					info={it.cancelled ? cancelled : undefined}
					showAddress={true}
				/>
			</a>
		{/each}
	</div>
{/snippet}

<div class="flex flex-col gap-4">
	{@render journeyList(plannedJourneys)}
	{t.cancelledJourneys}
	{@render journeyList(pastJourneys)}
</div>
