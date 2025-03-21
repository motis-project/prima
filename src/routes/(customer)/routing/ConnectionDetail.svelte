<script lang="ts">
	import ArrowRight from 'lucide-svelte/icons/arrow-right';
	import type { Itinerary, Leg } from '$lib/openapi';
	import { Button } from '$lib/shadcn/button';
	import { t } from '$lib/i18n/translation';
	import Time from './Time.svelte';
	import { formatDistanceMeters, formatDurationSec } from './formatDuration';
	import { getModeName } from './getModeName';
	import Route from './Route.svelte';
	import { routeBorderColor, routeColor } from './modeStyle';

	const {
		itinerary,
		onClickStop,
		onClickTrip,
		licensePlate
	}: {
		itinerary: Itinerary;
		onClickStop: (name: string, stopId: string, time: Date) => void;
		onClickTrip: (tripId: string) => void;
		licensePlate?: string;
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
		class="w-16 py-1 font-semibold leading-tight"
		queriedTime={timestamp}
		{isRealtime}
		{timestamp}
		{scheduledTimestamp}
	/>
	<Time
		variant="realtime"
		class="w-16 py-1 font-semibold leading-tight"
		{isRealtime}
		{timestamp}
		{scheduledTimestamp}
	/>
	{#if stopId}
		<Button
			class="h-auto min-h-14 justify-normal gap-0 overflow-x-hidden text-wrap py-1 text-left text-[length:inherit] leading-tight"
			variant="link"
			onclick={() => onClickStop(name, stopId, new Date(timestamp))}
		>
			{name}
		</Button>
	{:else}
		<span
			class="inline-flex h-auto min-h-14 items-center justify-normal gap-0 overflow-x-hidden text-wrap px-4 py-1 text-left text-[length:inherit] leading-tight"
			>{name}</span
		>
	{/if}
{/snippet}

{#snippet streetLeg(l: Leg)}
	<div class="flex flex-col gap-y-4 py-8 pl-8 text-muted-foreground">
		{#if l.mode === 'ODM'}
			<Button
				onclick={() =>
					window.open(
						`https://www.google.com/maps/dir/?api=1&destination=${l.from.lat},${l.from.lon}&travelmode=walking`
					)}
				class="ml-6 w-fit"
			>
				{t.meetingPointNavigation}
			</Button>
			{#if licensePlate != undefined}
				<div class="ml-6 flex w-fit rounded-md border-2 border-black bg-white p-1 shadow">
					<div
						class="mr-2 flex h-8 min-w-5 items-center justify-center rounded bg-blue-700 p-1 text-white"
					>
						<div class="text-sm font-bold">D</div>
					</div>
					<div
						class="flex h-8 items-center px-2 text-2xl font-bold uppercase tracking-wider text-black"
					>
						{licensePlate}
					</div>
				</div>
			{/if}
		{/if}
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

<div class="overflow-x-hidden text-lg">
	{#each itinerary.legs as l, i}
		{@const isLast = i == itinerary.legs.length - 1}
		{@const isLastPred = i == itinerary.legs.length - 2}
		{@const pred = i == 0 ? undefined : itinerary.legs[i - 1]}
		{@const next = isLast ? undefined : itinerary.legs[i + 1]}

		{#if l.routeShortName}
			<div class="flex w-full items-center justify-between space-x-1">
				<Route {onClickTrip} {l} />
				{#if pred && (pred.from.track || pred.duration !== 0) && (i != 1 || pred.routeShortName)}
					<div class="h-0 shrink grow border-t"></div>
					<div class="px-2 text-sm leading-none text-muted-foreground">
						{#if pred.from.track}
							{t.arrivalOnTrack} {pred.from.track}{pred.duration ? ',' : ''}
						{/if}
						{#if pred.duration}
							<span class="text-nowrap">{formatDurationSec(pred.duration)} {t.walk}</span>
						{/if}
						{#if pred.distance}
							<span class="text-nowrap">({Math.round(pred.distance)} m)</span>
						{/if}
					</div>
				{/if}
				<div class="h-0 shrink grow border-t"></div>
				{#if l.from.track}
					<div class="text-nowrap rounded-xl border px-2">
						{t.track}
						{l.from.track}
					</div>
				{/if}
			</div>

			<div class="relative left-4 border-l-4 pl-6 pt-2" style={routeBorderColor(l)}>
				<div class="grid grid-cols-[max-content_max-content_auto] items-center gap-y-6">
					{@render stopTimes(
						l.startTime,
						l.scheduledStartTime,
						l.realTime,
						l.from.name,
						l.from.stopId
					)}
				</div>
				{#if l.headsign}
					<div class="mt-2 flex items-center leading-none text-muted-foreground">
						<ArrowRight class="h-4 w-4 stroke-muted-foreground" />
						<span class="ml-1">{l.headsign}</span>
					</div>
				{/if}
				{#if l.intermediateStops?.length === 0}
					<div class="flex items-center py-6 pl-1 text-muted-foreground md:pl-4">
						{t.tripIntermediateStops(0)}
					</div>
				{:else}
					<details class="mt-2 [&_svg]:open:-rotate-180">
						<summary class="flex items-center py-6 pl-1 text-muted-foreground md:pl-4">
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
							<span class="ml-2 cursor-pointer">
								{t.tripIntermediateStops(l.intermediateStops?.length ?? 0)}
								<span class="text-nowrap">({formatDurationSec(l.duration)})</span>
							</span>
						</summary>
						<div class="grid grid-cols-[max-content_max-content_auto] items-center gap-y-0">
							{#each l.intermediateStops! as s}
								{@render stopTimes(s.arrival!, s.scheduledArrival!, l.realTime, s.name!, s.stopId)}
							{/each}
						</div>
					</details>
				{/if}

				{#if !isLast && !(isLastPred && next!.duration === 0)}
					<div class="grid grid-cols-[max-content_max-content_auto] items-center gap-y-6 pb-3">
						{@render stopTimes(
							l.endTime!,
							l.scheduledEndTime!,
							l.realTime!,
							l.to.name,
							l.to.stopId
						)}
					</div>
				{/if}

				{#if isLast || (isLastPred && next!.duration === 0)}
					<!-- fill visual gap -->
					<div class="pb-8"></div>
				{/if}
			</div>
		{:else if !(isLast && l.duration === 0) && ((i == 0 && l.duration !== 0) || !next || !next.routeShortName || l.mode != 'WALK' || (pred && (pred.mode == 'BIKE' || pred.mode == 'RENTAL')))}
			<Route {onClickTrip} {l} />
			<div class="relative left-4 border-l-4 pl-6 pt-2" style={routeBorderColor(l)}>
				<div class="grid grid-cols-[max-content_max-content_auto] items-center gap-y-6">
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
					<div class="grid grid-cols-[max-content_max-content_auto] items-center gap-y-6 pb-2">
						{@render stopTimes(l.endTime, l.scheduledEndTime, l.realTime, l.to.name, l.to.stopId)}
					</div>
				{/if}
				{#if isLast || (isLastPred && next!.duration === 0)}
					<!-- fill visual gap -->
					<div class="pb-4"></div>
				{/if}
			</div>
		{/if}
	{/each}
	<div class="relative left-4 pl-6">
		<div
			class="absolute left-[-5px] top-[0px] h-[15px] w-[15px] rounded-full"
			style={routeColor(lastLeg!)}
		></div>
		<div
			class="relative left-[4px] top-[-20px] grid grid-cols-[max-content_max-content_auto] items-center gap-y-6"
		>
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
