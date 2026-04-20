<script lang="ts">
	import Alert from 'lucide-svelte/icons/triangle-alert';
	import ItinerarySummary from '../routing/ItinerarySummary.svelte';
	import { t } from '$lib/i18n/translation';
	import type { Itinerary } from '$lib/openapi';
	import Button from '$lib/shadcn/button/button.svelte';
	import { Info, Plus } from 'lucide-svelte';
	import RoutingNotifications from '$lib/ui/RoutingNotifications.svelte';

	const { data } = $props();
	let notificationRows = $state(data.notifications);
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

{#snippet negotiatingAndComitted()}
	<Alert class="size-4" />
	{t.msg.openAndAcceptedRequest}
{/snippet}

{#snippet comitted()}
	<Info class="size-4" />
	{t.msg.acceptedRequest}
{/snippet}

{#snippet journeyList(
	journeys: {
		journey: Itinerary;
		id: number;
		cancelled: boolean | null;
		negotiating: boolean | null;
		comitted: boolean | null;
	}[]
)}
	<div class="flex flex-col gap-4">
		{#each journeys as it}
			<a href="/ride-offers/{it.id}">
				<ItinerarySummary
					it={it.journey}
					info={it.cancelled
						? cancelled
						: it.negotiating && it.comitted
							? negotiatingAndComitted
							: it.negotiating
								? negotiating
								: it.comitted
									? comitted
									: undefined}
					infoVariant={it.negotiating ? 'text-warning' : it.comitted ? 'text-success' : undefined}
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
	{#if data.notifications.length !== 0}
		<RoutingNotifications bind:rows={notificationRows}></RoutingNotifications>
	{/if}
	{@render journeyList(plannedJourneys)}
	{#if pastJourneys.length !== 0}
		{t.cancelledJourneys}
	{/if}
	{@render journeyList(pastJourneys)}
</div>
