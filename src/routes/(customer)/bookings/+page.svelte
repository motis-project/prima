<script lang="ts">
	import Alert from 'lucide-svelte/icons/triangle-alert';
	import ItinerarySummary from '../routing/ItinerarySummary.svelte';
	import { t } from '$lib/i18n/translation';
	import type { Itinerary } from '$lib/openapi';
	import { Button } from '$lib/shadcn/button';
	import { Car } from 'lucide-svelte';

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
	{t.msg.stillNegotiating}
{/snippet}

{#snippet journeyList(
	journeys: {
		journey: Itinerary;
		id: number;
		ticketCode: string | null;
		cancelled: boolean | null;
		pending: boolean | null;
	}[]
)}
	<div class="flex flex-col gap-4">
		{#each journeys as it}
			<a href="/bookings/{it.id}">
				<ItinerarySummary
					it={it.journey}
					info={it.cancelled ? cancelled : it.pending ? negotiating : undefined}
					showAddress={true}
				/>
			</a>
		{/each}
	</div>
{/snippet}

<div class="flex h-full flex-col gap-4 md:min-h-[70dvh] md:w-96">
	<div class="flex items-center justify-between gap-4">
		<a href="/ride-offers" class="w-full">
			<Button class="w-full">
				<Car class="mr-1 size-4" />
				{t.ride.myRideOffers}
			</Button>
		</a>
	</div>
	<h2 class="text-xl">{t.bookingsHeader}</h2>
	{#if plannedJourneys.length === 0 && pastJourneys.length === 0}
		<p>{t.noBookings}</p>
	{/if}
	{@render journeyList(plannedJourneys)}
	{#if pastJourneys.length !== 0}
		{t.cancelledJourneys}
	{/if}
	{@render journeyList(pastJourneys)}
</div>
