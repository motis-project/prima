<script lang="ts">
	import LoaderCircle from 'lucide-svelte/icons/loader-circle';
	import { Card } from '$lib/shadcn/card';
	import ErrorMessage from './ErrorMessage.svelte';
	import { Separator } from '$lib/shadcn/separator';
	import { formatDurationSec } from './formatDuration';
	import { getModeStyle, routeColor } from './modeStyle';
	import {
		plan,
		type Itinerary,
		type Leg,
		type PlanData,
		type PlanError,
		type PlanResponse
	} from '$lib/openapi';
	import Time from './Time.svelte';
	import { t } from '$lib/i18n/translation';
	import DirectConnection from './DirectConnection.svelte';
	import type { RequestResult } from '@hey-api/client-fetch';

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

	const throwOnError = (promise: RequestResult<PlanResponse, PlanError, false>) =>
		promise.then((response) => {
			console.log(response.error);
			if (response.error)
				throw new Error(
					String((response.error as Record<string, unknown>).error ?? response.error)
				);
			return response.data!;
		});
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
			<div class="flex flex-col space-y-6 px-4 py-8">
				{#each routingResponses as r, rI}
					{#await r}
						<div class="flex w-full items-center justify-center">
							<LoaderCircle class="m-20 h-12 w-12 animate-spin" />
						</div>
					{:then r}
						{#if rI === 0 && baseQuery}
							<div class="flex w-full items-center justify-between space-x-4">
								<div class="h-0 w-full border-t"></div>
								<button
									onclick={() => {
										routingResponses.splice(
											0,
											0,
											throwOnError(
												plan({
													query: { ...baseQuery.query, pageCursor: r.previousPageCursor }
												})
											)
										);
									}}
									class="text-nowrap rounded-lg border bg-blue-600 px-2 py-1 text-sm font-bold text-white hover:!bg-blue-700"
								>
									{t.earlier}
								</button>
								<div class="h-0 w-full border-t"></div>
							</div>
						{/if}
						{#each r.itineraries as it}
							<button
								onclick={() => {
									selectItinerary(it);
								}}
							>
								<Card class="p-4">
									<div class="flex h-8 w-full items-center justify-around space-x-1 text-base">
										<div class="basis-1/4 overflow-hidden">
											<div class="text-xs font-bold uppercase text-slate-400">{t.departure}</div>
											<Time
												isRealtime={it.legs[0].realTime}
												timestamp={it.startTime}
												scheduledTimestamp={it.legs[0].scheduledStartTime}
												variant={'realtime-show-always'}
											/>
										</div>
										<Separator orientation="vertical" />
										<div class="basis-1/4 overflow-hidden">
											<div class="text-xs font-bold uppercase text-slate-400">{t.arrival}</div>
											<Time
												isRealtime={it.legs[it.legs.length - 1].realTime}
												timestamp={it.endTime}
												scheduledTimestamp={it.legs[it.legs.length - 1].scheduledEndTime}
												variant={'realtime-show-always'}
											/>
										</div>
										<Separator orientation="vertical" />
										<div class="basis-1/4 overflow-hidden">
											<div class="text-xs font-bold uppercase text-slate-400">{t.transfers}</div>
											<div class="text-center">{it.transfers}</div>
										</div>
										<Separator orientation="vertical" />
										<div class="basis-1/4 overflow-hidden">
											<div class="text-xs font-bold uppercase text-slate-400">{t.duration}</div>
											<div class="text-nowrap text-center">
												{formatDurationSec(it.duration)}
											</div>
										</div>
									</div>
									<Separator class="my-2" />
									<div class="mt-4 flex flex-wrap gap-x-3 gap-y-3">
										{#each it.legs.filter((l, i) => (i == 0 && l.duration > 1) || (i == it.legs.length - 1 && l.duration > 1) || l.routeShortName || l.mode != 'WALK') as l}
											{@render legSummary(l)}
										{/each}
									</div>
								</Card>
							</button>
						{/each}
						{#if rI === routingResponses.length - 1 && baseQuery}
							<div class="flex w-full items-center justify-between space-x-4">
								<div class="h-0 w-full border-t"></div>
								<button
									onclick={() => {
										routingResponses.push(
											throwOnError(
												plan({
													query: { ...baseQuery.query, pageCursor: r.nextPageCursor }
												})
											)
										);
									}}
									class="text-nowrap rounded-lg border bg-blue-600 px-2 py-1 text-sm font-bold text-white hover:!bg-blue-700"
								>
									{t.later}
								</button>
								<div class="h-0 w-full border-t"></div>
							</div>
						{/if}
					{:catch e}
						<ErrorMessage {e} />
					{/await}
				{/each}
			</div>
		{:else if r.direct.length === 0}
			<ErrorMessage e={t.noItinerariesFound} />
		{/if}
	{:catch e}
		<ErrorMessage {e} />
	{/await}
{/if}
