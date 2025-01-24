<script lang="ts">
	import ArrowRight from 'lucide-svelte/icons/arrow-right';
	import type { Itinerary, Leg } from '$lib/openapi';
	import { Button } from '$lib/shadcn/button';
	import { t } from '$lib/i18n/translation';

	import { formatDurationSec, formatDistanceMeters } from './formatDuration';
	import { routeBorderColor, routeColor } from './modeStyle';
	import { getModeName } from './getModeName';
	import Route from './Route.svelte';
	import Time from './Time.svelte';

	const {
		itinerary,
		onClickStop,
		onClickTrip
	}: {
		itinerary: Itinerary;
		onClickStop: (name: string, stopId: string, time: Date) => void;
		onClickTrip: (tripId: string) => void;
	} = $props();

	const lastLeg = $derived(itinerary.legs.findLast((l) => l.duration !== 0));
</script>

{#snippet stopTimes(
	timestamp: string,
	scheduledTimestamp: string,
	isRealtime: boolean,
	name: string,
	stopId?: string
)}
	<Time
		variant="schedule"
		class="mr-2 font-semibold"
		{isRealtime}
		{timestamp}
		{scheduledTimestamp}
	/>
	<Time variant="realtime" class="font-semibold" {isRealtime} {timestamp} {scheduledTimestamp} />
	{#if stopId}
		<Button
			class="col-span-5 mr-6 justify-normal text-wrap text-left text-lg"
			variant="link"
			onclick={() => {
				onClickStop(name, stopId, new Date(timestamp));
			}}
		>
			{name}
		</Button>
	{:else}
		<span class="col-span-5 mr-6">{name}</span>
	{/if}
{/snippet}

{#snippet streetLeg(l: Leg)}
	<div class="flex flex-col gap-y-4 py-12 pl-8 text-muted-foreground">
		<span class="ml-6">
			{formatDurationSec(l.duration)}
			{getModeName(l)}
			{formatDistanceMeters(Math.round(l.distance!))}
		</span>
		{#if l.rental && l.rental.systemName}
			<span class="ml-6">
				{t.sharingProvider}: <a href={l.rental.url} target="_blank">{l.rental.systemName}</a>
			</span>
		{/if}
		{#if l.rental?.returnConstraint == 'ROUNDTRIP_STATION'}
			<span class="ml-6">
				{t.roundtripStationReturnConstraint}
			</span>
		{/if}
	</div>
{/snippet}

<div class="p-2 pb-4 text-lg">
	{#each itinerary.legs as l, i}
		{@const isLast = i == itinerary.legs.length - 1}
		{@const isLastPred = i == itinerary.legs.length - 2}
		{@const pred = i == 0 ? undefined : itinerary.legs[i - 1]}
		{@const next = isLast ? undefined : itinerary.legs[i + 1]}

		{#if l.routeShortName}
			<div class="flex w-full items-center justify-between space-x-1">
				<Route {onClickTrip} {l} />
				{#if pred && (pred.from.track || pred.duration !== 0)}
					<div class="h-0 w-full border-t"></div>
					<div class="text-nowrap px-2 text-sm text-muted-foreground">
						{#if pred.from.track}
							{t.arrivalOnTrack} {pred.from.track}{pred.duration ? ',' : ''}
						{/if}
						{#if pred.duration}
							{formatDurationSec(pred.duration)} {t.walk}
						{/if}
						{#if pred.distance}
							({Math.round(pred.distance)} m)
						{/if}
					</div>
				{/if}
				<div class="h-0 w-full border-t"></div>
				{#if l.from.track}
					<div class="text-nowrap rounded-xl border px-2">
						{t.track}
						{l.from.track}
					</div>
				{/if}
			</div>

			<div class="ml-4 border-l-4 pl-4 pt-4" style={routeBorderColor(l)}>
				<div class="grid grid-cols-7 items-center gap-y-6">
					{@render stopTimes(
						l.startTime,
						l.scheduledStartTime,
						l.realTime,
						l.from.name,
						l.from.stopId
					)}
				</div>
				{#if l.headsign}
					<div class="mt-2 flex items-center text-muted-foreground">
						<ArrowRight class="h-4 w-4 stroke-muted-foreground" />
						<span class="ml-1">{l.headsign}</span>
					</div>
				{/if}
				{#if l.intermediateStops?.length === 0}
					<div class="flex items-center py-12 pl-8 text-muted-foreground">
						{t.tripIntermediateStops(0)}
					</div>
				{:else}
					<details class="[&_svg]:open:-rotate-180">
						<summary class="flex items-center py-12 pl-4 text-muted-foreground">
							<svg
								class="rotate-0 transform transition-all duration-300"
								fill="none"
								height="20"
								width="20"
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								viewBox="0 0 24 24"
							>
								<polyline points="6 9 12 15 18 9"></polyline>
							</svg>
							<span class="ml-4 cursor-pointer">
								{t.tripIntermediateStops(l.intermediateStops?.length ?? 0)}<br />
								({formatDurationSec(l.duration)})
							</span>
						</summary>
						<div class="mb-6 grid grid-cols-7 items-center gap-y-6">
							{#each l.intermediateStops! as s}
								{@render stopTimes(s.arrival!, s.scheduledArrival!, l.realTime, s.name!, s.stopId)}
							{/each}
						</div>
					</details>
				{/if}

				{#if !isLast && !(isLastPred && next!.duration === 0)}
					<div class="grid grid-cols-7 items-center gap-y-6 pb-3">
						{@render stopTimes(
							l.endTime!,
							l.scheduledEndTime!,
							l.realTime!,
							l.to.name,
							l.to.stopId
						)}
					</div>
				{/if}

				{#if isLast}
					<!-- fill visual gap -->
					<div class="pb-2"></div>
				{/if}
			</div>
		{:else if !(isLast && l.duration === 0) && ((i == 0 && l.duration !== 0) || !next || !next.routeShortName || l.mode != 'WALK' || (pred && (pred.mode == 'BIKE' || pred.mode == 'RENTAL')))}
			<Route {onClickTrip} {l} />
			<div class="relative left-4 border-l-4 pl-6 pt-4" style={routeBorderColor(l)}>
				<div class="grid grid-cols-7 items-center gap-y-6">
					{@render stopTimes(
						l.startTime,
						l.scheduledStartTime,
						l.realTime,
						l.from.name,
						l.from.stopId
					)}
				</div>
				{@render streetLeg(l)}
				{#if !isLast}
					<div class="grid grid-cols-7 items-center gap-y-6 pb-4">
						{@render stopTimes(l.endTime, l.scheduledEndTime, l.realTime, l.to.name, l.to.stopId)}
					</div>
				{/if}
			</div>
		{/if}
	{/each}
	<div class="flex">
		<div
			class="relative left-[11.5px] h-3 w-3 shrink-0 rounded-full pt-2"
			style={routeColor(lastLeg!)}
		></div>
		<div class="relative bottom-[7px] left-3 grid grid-cols-7 items-center gap-y-6 pl-4">
			{@render stopTimes(
				lastLeg!.endTime,
				lastLeg!.scheduledEndTime,
				lastLeg!.realTime,
				lastLeg!.to.name,
				lastLeg!.to.stopId
			)}
		</div>
	</div>
</div>
