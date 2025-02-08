<script lang="ts">
	import * as Card from '$lib/shadcn/card';
	import { Separator } from '$lib/shadcn/separator';
	import { Button } from '$lib/shadcn/button';
	import { plan, type Itinerary, type Leg, type PlanData, type PlanResponse } from '$lib/openapi';
	import LoaderCircle from 'lucide-svelte/icons/loader-circle';
	import { t } from '$lib/i18n/translation';

	import Time from './Time.svelte';
	import { formatDurationSec } from './formatDuration';
	import { getModeStyle, routeColor } from './modeStyle';

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

{#snippet legSummary(l: Leg)}
	<div
		class="flex h-8 items-center text-nowrap rounded-lg px-2 py-1 text-sm font-bold"
		style={routeColor(l)}
	>
		<svg class="relative mr-1 h-4 w-4 rounded-full">
			<use xlink:href={`#${getModeStyle(l)[0]}`}></use>
		</svg>
		{#if l.routeShortName}
			{l.routeShortName}
		{:else}
			{formatDurationSec(l.duration)}
		{/if}
	</div>
{/snippet}

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
								<Card.Root class="border-input">
									<Card.Content class="flex flex-col gap-4 p-4">
										<div class="flex gap-4">
											<span>{formatDurationSec(it.duration)}</span>
											<Separator orientation="vertical" />
											{it.transfers}
											{t.transfers}
										</div>
										<span class="text-left">
											<Time
												class="inline"
												isRealtime={it.legs[0].realTime}
												timestamp={it.startTime}
												scheduledTimestamp={it.legs[0].scheduledStartTime}
												variant={'realtime-show-always'}
											/> - <Time
												class="inline"
												isRealtime={it.legs[it.legs.length - 1].realTime}
												timestamp={it.endTime}
												scheduledTimestamp={it.legs[it.legs.length - 1].scheduledEndTime}
												variant="realtime-show-always"
											/>
										</span>
										<div class="flex flex-wrap gap-x-3 gap-y-3">
											{#each it.legs.filter((l, i) => (i == 0 && l.duration > 1) || (i == it.legs.length - 1 && l.duration > 1) || l.routeShortName || l.mode != 'WALK') as l}
												{@render legSummary(l)}
											{/each}
										</div>
									</Card.Content>
								</Card.Root>
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
