<script lang="ts">
	import { stoptimes, type StoptimesResponse } from '$lib/openapi';
	import { Button } from '$lib/shadcn/button';
	import LoaderCircle from 'lucide-svelte/icons/loader-circle';
	import ArrowRight from 'lucide-svelte/icons/arrow-right';
	import { t } from '$lib/i18n/translation';

	import Time from './Time.svelte';
	import Route from './Route.svelte';

	let {
		stopId,
		time: queryTime,
		arriveBy = $bindable(),
		onClickTrip
	}: {
		stopId: string;
		time: Date;
		arriveBy?: boolean;
		onClickTrip: (tripId: string) => void;
	} = $props();

	let query = $derived({ stopId, time: queryTime.toISOString(), arriveBy, n: 10 });
	let responses = $state<Array<Promise<StoptimesResponse>>>([]);
	$effect(() => {
		responses = [stoptimes({ query }).then((r) => r.data!)];
	});
</script>

<div class="grid auto-rows-fr grid-cols-10 items-center gap-y-2 text-base">
	<div class="col-span-full flex w-full items-center justify-center">
		<Button
			class="font-bold"
			variant="outline"
			onclick={() => {
				arriveBy = !arriveBy;
			}}
		>
			{#if arriveBy}
				{t.switchToDepartures}
			{:else}
				{t.switchToArrivals}
			{/if}
		</Button>
	</div>
	{#each responses as r, rI}
		{#await r}
			<div class="col-span-full flex w-full items-center justify-center">
				<LoaderCircle class="m-20 h-12 w-12 animate-spin" />
			</div>
		{:then r}
			{#if rI === 0}
				<div class="col-span-full flex w-full items-center justify-between space-x-4">
					<div class="h-0 w-full border-t"></div>
					<button
						onclick={() => {
							responses.splice(
								0,
								0,
								stoptimes({ query: { ...query, pageCursor: r.previousPageCursor } }).then(
									(x) => x.data!
								)
							);
						}}
						class="rounded-lg border bg-blue-600 px-2 py-1 text-sm font-bold text-white hover:!bg-blue-700"
					>
						{t.earlier}
					</button>
					<div class="h-0 w-full border-t"></div>
				</div>
			{/if}

			{#each r.stopTimes as t}
				{@const timestamp = arriveBy ? t.place.arrival! : t.place.departure!}
				{@const scheduledTimestamp = arriveBy
					? t.place.scheduledArrival!
					: t.place.scheduledDeparture!}
				<Route
					class="col-span-3 w-fit max-w-28 overflow-hidden text-ellipsis"
					l={t}
					{onClickTrip}
				/>
				<Time
					class="ml-1"
					variant="schedule"
					isRealtime={t.realTime}
					{timestamp}
					{scheduledTimestamp}
				/>
				<Time
					class="ml-2"
					variant="realtime"
					isRealtime={t.realTime}
					{timestamp}
					{scheduledTimestamp}
				/>
				<div class="col-span-5 ml-4 flex items-center text-muted-foreground">
					<div><ArrowRight class="h-4 w-4 stroke-muted-foreground" /></div>
					<span class="ml-1 overflow-hidden text-ellipsis text-nowrap">{t.headsign}</span>
				</div>
			{/each}

			{#if rI === responses.length - 1}
				<div class="col-span-full flex w-full items-center justify-between space-x-4">
					<div class="h-0 w-full border-t"></div>
					<button
						onclick={() => {
							responses.push(
								stoptimes({ query: { ...query, pageCursor: r.nextPageCursor } }).then(
									(x) => x.data!
								)
							);
						}}
						class="rounded-lg border bg-blue-600 px-2 py-1 text-sm font-bold text-white hover:!bg-blue-700"
					>
						{t.later}
					</button>
					<div class="h-0 w-full border-t"></div>
				</div>
			{/if}
		{/await}
	{/each}
</div>
