<script lang="ts">
	import { Separator } from '$lib/shadcn/separator';
	import * as Card from '$lib/shadcn/card';
	import { formatDurationSec } from './formatDuration';
	import Time from './Time.svelte';
	import type { Itinerary, Leg, PlanData } from '$lib/openapi';
	import { getModeStyle, routeColor } from './modeStyle';
	import { t } from '$lib/i18n/translation';
	import DateInput from './DateInput.svelte';

	const { it, baseQuery }: { it: Itinerary; baseQuery: PlanData | undefined } = $props();
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
				queriedTime={baseQuery?.query.time}
			/> - <Time
				class="inline"
				isRealtime={it.legs[it.legs.length - 1].realTime}
				timestamp={it.endTime}
				scheduledTimestamp={it.legs[it.legs.length - 1].scheduledEndTime}
				variant="realtime-show-always"
				queriedTime={baseQuery?.query.time}
			/>
		</span>
		<div class="flex flex-wrap gap-x-3 gap-y-3">
			{#each it.legs.filter((l, i) => (i == 0 && l.duration > 1) || (i == it.legs.length - 1 && l.duration > 1) || l.routeShortName || l.mode != 'WALK') as l}
				{@render legSummary(l)}
			{/each}
		</div>
	</Card.Content>
</Card.Root>
