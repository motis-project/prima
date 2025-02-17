<script lang="ts">
	import { Button } from '$lib/shadcn/button';
	import { plan, type Itinerary, type PlanData, type PlanResponse } from '$lib/openapi';
	import LoaderCircle from 'lucide-svelte/icons/loader-circle';
	import { t } from '$lib/i18n/translation';
	import ItinerarySummary from './ItinerarySummary.svelte';

	let {
		routingResponses,
		baseResponse,
		baseQuery,
		selectItinerary
	}: {
		routingResponses: Array<Promise<PlanResponse>>;
		baseResponse: Promise<PlanResponse> | undefined;
		baseQuery: PlanData | undefined;
		selectItinerary: (it: Itinerary) => void;
	} = $props();
</script>

{#if baseResponse}
	{#await baseResponse}
		<div class="flex w-full items-center justify-center">
			<LoaderCircle class="m-20 h-12 w-12 animate-spin" />
		</div>
	{:then r}
		{#if r.direct.length !== 0}
			<div class="my-4 flex flex-wrap gap-x-3 gap-y-3">
				{#each r.direct as d}
					<DirectConnection
						{d}
						onclick={() => {
							selectItinerary(d);
						}}
					/>
				{/each}
			</div>
		{/if}

		{#if r.itineraries.length !== 0}
			<div class="flex flex-col gap-4">
				{#each routingResponses as r, rI}
					{#await r}
						<div class="flex w-full items-center justify-center">
							<LoaderCircle class="m-20 h-12 w-12 animate-spin" />
						</div>
					{:then r}
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
											}).then((x) => x.data!)
										);
									}}
								>
									{t.earlier}
								</Button>
								<div class="h-0 w-full border-t"></div>
							</div>
						{/if}
						{#each r.itineraries as it}
							<button onclick={() => selectItinerary(it)}>
								<ItinerarySummary {it} />
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
												(x) => x.data!
											)
										);
									}}
								>
									{t.later}
								</Button>
								<div class="h-0 w-full border-t"></div>
							</div>
						{/if}
					{:catch e}
						<div>Error: {e}</div>
					{/await}
				{/each}
			</div>
		{/if}
	{/await}
{/if}
