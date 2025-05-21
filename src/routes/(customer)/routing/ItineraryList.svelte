<script lang="ts">
	import { Button } from '$lib/shadcn/button';
	import { plan, type Itinerary, type PlanData, type PlanResponse } from '$lib/openapi';
	import LoaderCircle from 'lucide-svelte/icons/loader-circle';
	import Info from 'lucide-svelte/icons/info';
	import { t, language } from '$lib/i18n/translation';
	import ItinerarySummary from './ItinerarySummary.svelte';
	import { odmPrice, getEuroString } from '$lib/util/odmPrice';

	let {
		routingResponses,
		baseResponse,
		baseQuery,
		selectItinerary,
		updateStartDest,
		passengers,
		kids
	}: {
		routingResponses: Array<Promise<PlanResponse | undefined>>;
		baseResponse: Promise<PlanResponse | undefined> | undefined;
		baseQuery: PlanData | undefined;
		selectItinerary: (it: Itinerary) => void;
		updateStartDest: (r: { data: PlanResponse | undefined }) => PlanResponse | undefined;
		passengers: number;
		kids: number;
	} = $props();

	const localDate = (timestamp: string) => {
		const d = new Date(timestamp);
		return d.toLocaleString(language, { weekday: 'long' }) + ', ' + d.toLocaleDateString();
	};
</script>

{#snippet odmInfo(it: Itinerary)}
	<Info class="size-4" /> {t.booking.bookHere} {getEuroString(odmPrice(it, passengers, kids))}
{/snippet}

{#if baseResponse}
	{#await baseResponse}
		<div class="flex w-full items-center justify-center">
			<LoaderCircle class="m-20 h-12 w-12 animate-spin" />
		</div>
	{:then r}
		{#if r == undefined}
			Error
		{:else if r.itineraries.length !== 0}
			<div class="flex flex-col gap-4">
				{#each routingResponses as r, rI}
					{#await r}
						<div class="flex w-full items-center justify-center">
							<LoaderCircle class="m-20 h-12 w-12 animate-spin" />
						</div>
					{:then r}
						{#if r}
							{#if rI === 0 && baseQuery}
								<div class="flex w-full items-center justify-between space-x-4">
									<div class="h-0 w-full border-t"></div>
									<Button
										class="h-8"
										variant="outline"
										onclick={() => {
											routingResponses.splice(
												0,
												0,
												plan({
													query: { ...baseQuery.query, pageCursor: r.previousPageCursor }
												}).then(updateStartDest)
											);
										}}
									>
										{t.earlier}
									</Button>
									<div class="h-0 w-full border-t"></div>
								</div>
							{/if}

							{#each r.itineraries as it, index}
								{#if index > 0 && localDate(r.itineraries[index - 1].startTime) != localDate(it.startTime)}
									<div class="my-5 flex w-full items-center justify-between space-x-1">
										<div class="h-0 shrink grow border-t"></div>
										<div class="px-2 font-bold">{localDate(it.startTime)}</div>
										<div class="h-0 shrink grow border-t"></div>
									</div>
								{/if}
								{@const hasODM = it.legs.some((l) => l.mode === 'ODM')}
								<button onclick={() => selectItinerary(it)}>
									<ItinerarySummary {it} {baseQuery} info={hasODM ? odmInfo : undefined} />
								</button>
							{/each}

							{#if rI === routingResponses.length - 1 && baseQuery}
								<div class="flex w-full items-center justify-between space-x-4">
									<div class="h-0 w-full border-t"></div>
									<Button
										class="h-8"
										variant="outline"
										onclick={() => {
											routingResponses.push(
												plan({ query: { ...baseQuery.query, pageCursor: r.nextPageCursor } }).then(
													updateStartDest
												)
											);
										}}
									>
										{t.later}
									</Button>
									<div class="h-0 w-full border-t"></div>
								</div>
							{/if}
						{:else}
							Error
						{/if}
					{:catch e}
						<div>Error: {e}</div>
					{/await}
				{/each}
			</div>
		{:else}
			<div>{t.noItinerariesFound}</div>
		{/if}
	{/await}
{/if}
