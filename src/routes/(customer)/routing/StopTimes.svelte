<script lang="ts">
	import { stoptimes, type StoptimesError, type StoptimesResponse } from '$lib/openapi';
	import LoaderCircle from 'lucide-svelte/icons/loader-circle';
	import ArrowRight from 'lucide-svelte/icons/arrow-right';
	import { t } from '$lib/i18n/translation';
	import type { RequestResult } from '@hey-api/client-fetch';
	import Route from './Route.svelte';
	import Time from './Time.svelte';
	import ErrorMessage from './ErrorMessage.svelte';
	import { Button } from '$lib/shadcn/button';

	let {
		stopId,
		time: queryTime,
		stopNameFromResponse = $bindable(),
		arriveBy,
		setArriveBy,
		onClickTrip
	}: {
		stopId: string;
		time: Date;
		arriveBy?: boolean;
		stopNameFromResponse: string;
		setArriveBy: (arriveBy: boolean) => void;
		onClickTrip: (tripId: string) => void;
	} = $props();

	let query = $derived({ stopId, time: queryTime.toISOString(), arriveBy, n: 10 });
	let responses = $state<Array<Promise<StoptimesResponse>>>([]);
	$effect(() => {
		responses = [throwOnError(stoptimes({ query }))];
	});

	const throwOnError = (promise: RequestResult<StoptimesResponse, StoptimesError, false>) =>
		promise.then((response) => {
			if (response.error) {
				console.log(response.error);
				throw new Error('HTTP ' + response.response?.status);
			}
			stopNameFromResponse =
				(response.data?.stopTimes.length && response.data?.stopTimes[0].place?.name) || '';
			return response.data!;
		});
	stop;
</script>

<div
	class="grid auto-rows-fr grid-cols-[repeat(3,max-content)_auto] items-center gap-x-2 gap-y-2 text-base"
>
	<div class="col-span-full flex w-full items-center justify-center">
		<Button
			class="font-bold"
			variant="outline"
			onclick={() => {
				setArriveBy(!arriveBy);
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
								throwOnError(stoptimes({ query: { ...query, pageCursor: r.previousPageCursor } }))
							);
						}}
						class="text-nowrap rounded-lg border bg-blue-600 px-2 py-1 text-sm font-bold text-white hover:!bg-blue-700"
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
				<Route class="w-fit max-w-32 overflow-hidden text-ellipsis" l={t} {onClickTrip} />
				<Time variant="schedule" isRealtime={t.realTime} {timestamp} {scheduledTimestamp} />
				<Time variant="realtime" isRealtime={t.realTime} {timestamp} {scheduledTimestamp} />
				<div class="flex min-w-0 items-center text-muted-foreground">
					<div><ArrowRight class="h-4 w-4 stroke-muted-foreground" /></div>
					<span class="ml-1 overflow-hidden text-ellipsis leading-tight">{t.headsign}</span>
				</div>
			{/each}

			{#if rI === responses.length - 1}
				<div class="col-span-full flex w-full items-center justify-between space-x-4">
					<div class="h-0 w-full border-t"></div>
					<button
						onclick={() => {
							responses.push(
								throwOnError(stoptimes({ query: { ...query, pageCursor: r.nextPageCursor } }))
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
			<div class="col-span-full flex w-full items-center justify-center">
				<ErrorMessage {e} />
			</div>
		{/await}
	{/each}
</div>
