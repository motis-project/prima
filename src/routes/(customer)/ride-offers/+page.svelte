<script lang="ts">
	import Alert from 'lucide-svelte/icons/triangle-alert';
	import ItinerarySummary from '../routing/ItinerarySummary.svelte';
	import { t } from '$lib/i18n/translation';
	import type { Itinerary } from '$lib/openapi';
	import Button from '$lib/shadcn/button/button.svelte';
	import { Plus } from 'lucide-svelte';

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

{#snippet negotiating()}
	<Alert class="size-4" />
	{t.msg.openRequest}
{/snippet}

{#snippet journeyList(
	journeys: {
		journey: Itinerary;
		id: number;
		cancelled: boolean | null;
		negotiating: boolean | null;
	}[]
)}
	<div class="flex flex-col gap-4">
		{#each journeys as it}
			<a href="/ride-offers/{it.id}">
				<ItinerarySummary
					it={it.journey}
					info={it.cancelled ? cancelled : it.negotiating ? negotiating : undefined}
					infoVariant={it.negotiating ? 'warning' : undefined}
					showAddress={true}
				/>
			</a>
		{/each}
	</div>
{/snippet}

<div class="flex h-full flex-col gap-4 md:min-h-[70dvh] md:w-96">
	<div class="flex items-center justify-between gap-4 pb-8">
		<a href="/ride-offers/new" class="w-full">
			<Button class="w-full">
				<Plus class="mr-1 size-4" />
				{t.ride.create}
			</Button>
		</a>
	</div>
	{#if plannedJourneys.length === 0 && pastJourneys.length === 0}
		{t.noRideOffers}
	{/if}
	{@render journeyList(plannedJourneys)}
	{#if pastJourneys.length !== 0}
		{t.cancelledJourneys}
	{/if}
	{@render journeyList(pastJourneys)}
</div>
