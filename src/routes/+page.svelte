<script lang="ts">
	import { browser } from '$app/environment';
	import AddressTypeahead from './routing/AddressTypeahead.svelte';
	import { type Location } from './routing/Location';
	import { Input } from '$lib/shadcn/input';
	import { Calendar } from '$lib/shadcn/calendar';
	import * as RadioGroup from '$lib/shadcn/radio-group';
	import * as Drawer from '$lib/shadcn/drawer';
	import { Label } from '$lib/shadcn/label';
	import { t } from '$lib/i18n/translation';
	import { plan, trip, type Match, type PlanData, type PlanResponse } from '$lib/openapi';
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { Button, buttonVariants } from '$lib/shadcn/button';
	import ArrowUpDown from 'lucide-svelte/icons/arrow-up-down';
	import { ChevronDown } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { lngLatToStr } from './routing/lngLatToStr';
	import ItineraryList from './routing/ItineraryList.svelte';
	import ConnectionDetail from './routing/ConnectionDetail.svelte';
	import StopTimes from './routing/StopTimes.svelte';
	import { cn } from '$lib/shadcn/utils';

	const urlParams = browser ? new URLSearchParams(window.location.search) : undefined;

	let fromParam: Match | undefined = undefined;
	let toParam: Match | undefined = undefined;
	if (browser && urlParams && urlParams.has('from') && urlParams.has('to')) {
		fromParam = JSON.parse(urlParams.get('from') ?? '') ?? {};
		toParam = JSON.parse(urlParams.get('to') ?? '') ?? {};
	}
	let fromMatch = { match: fromParam };
	let toMatch = { match: fromParam };
	let from = $state<Location>({
		label: fromParam ? fromParam['name'] : '',
		value: fromParam ? fromMatch : {}
	});
	let to = $state<Location>({
		label: toParam ? toParam['name'] : '',
		value: toParam ? toMatch : {}
	});
	let fromItems = $state<Array<Location>>([]);
	let toItems = $state<Array<Location>>([]);

	const toPlaceString = (l: Location) => {
		if (l.value.match?.type === 'STOP') {
			return l.value.match.id;
		} else if (l.value.match?.level) {
			return `${lngLatToStr(l.value.match!)},${l.value.match.level}`;
		} else {
			return `${lngLatToStr(l.value.match!)},0`;
		}
	};
	let baseQuery = $derived(
		from.value.match && to.value.match
			? ({
					query: {
						time: new Date().toISOString(),
						fromPlace: toPlaceString(from),
						toPlace: toPlaceString(to),
						timetableView: true
					}
				} as PlanData)
			: undefined
	);

	type Timeout = ReturnType<typeof setTimeout>;
	let baseResponse = $state<Promise<PlanResponse>>();
	let routingResponses = $state<Array<Promise<PlanResponse>>>([]);
	let searchDebounceTimer: Timeout;
	$effect(() => {
		if (baseQuery) {
			clearTimeout(searchDebounceTimer);
			searchDebounceTimer = setTimeout(() => {
				const base = plan<true>(baseQuery).then((response) => response.data);
				baseResponse = base;
				routingResponses = [base];
			}, 400);
		}
	});

	let connectionsEl = $state<HTMLDivElement>();
	onMount(() => {
		if (connectionsEl) {
			connectionsEl.scrollTop = 48;
		}
	});

	const onClickTrip = async (tripId: string) => {
		const { data: itinerary, error } = await trip({ query: { tripId } });
		if (error) {
			alert(error);
			return;
		}
		pushState('', { selectedItinerary: itinerary });
	};
</script>

{#if page.state.selectFrom}
	<AddressTypeahead placeholder={t.from} bind:selected={from} items={fromItems} />
{:else if page.state.selectTo}
	<AddressTypeahead placeholder={t.to} bind:selected={to} items={toItems} />
{:else if page.state.selectedItinerary}
	<ConnectionDetail
		itinerary={page.state.selectedItinerary}
		onClickStop={(name: string, stopId: string, time: Date) =>
			pushState('', { stop: { name, stopId, time } })}
		{onClickTrip}
	/>
{:else if page.state.stop}
	<StopTimes
		arriveBy={false}
		time={page.state.stop.time}
		stopId={page.state.stop.stopId}
		{onClickTrip}
	/>
{:else}
	<div class="flex h-full flex-col gap-4">
		<div class="relative flex flex-col gap-4">
			<Input
				placeholder={t.from}
				class="text-sm"
				onfocus={() => pushState('', { selectFrom: true })}
				value={from.label}
			/>
			<Input
				placeholder={t.to}
				class="text-sm"
				onfocus={() => pushState('', { selectTo: true })}
				value={to.label}
			/>
			<Button
				class="absolute right-4 top-6 z-10 rounded-full"
				size="icon"
				onclick={() => {
					const tmp = to;
					to = from;
					from = tmp;

					const tmpItems = toItems;
					toItems = fromItems;
					fromItems = tmpItems;
				}}
			>
				<ArrowUpDown class="size-2" />
			</Button>
		</div>
		<div class="flex gap-4">
			<Drawer.Root>
				<Drawer.Trigger
					class={cn(
						buttonVariants({ variant: 'default' }),
						'h-8 grow gap-1 text-center text-sm font-medium'
					)}
				>
					Abfahrt Do, Jan 12, 14:21
					<ChevronDown />
				</Drawer.Trigger>
				<Drawer.Portal>
					<Drawer.Overlay class="fixed inset-0 bg-black/40" />
					<Drawer.Content>
						<RadioGroup.Root
							value="card"
							class="grid h-9 grid-cols-2 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground"
						>
							<Label
								for="card"
								class="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&:has([data-state=checked])]:bg-background [&:has([data-state=checked])]:text-foreground [&:has([data-state=checked])]:shadow"
							>
								<RadioGroup.Item value="card" id="card" class="sr-only" aria-label="Card" />
								{t.departure}
							</Label>
							<Label
								for="paypal"
								class="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&:has([data-state=checked])]:bg-background [&:has([data-state=checked])]:text-foreground [&:has([data-state=checked])]:shadow"
							>
								<RadioGroup.Item value="paypal" id="paypal" class="sr-only" aria-label="Paypal" />
								{t.arrival}
							</Label>
						</RadioGroup.Root>
						<div class="flex w-full justify-center">
							<Calendar class="w-fit" />
						</div>
					</Drawer.Content>
				</Drawer.Portal>
			</Drawer.Root>

			<Button class="h-8  gap-1 text-center text-sm font-medium">
				All Modes
				<ChevronDown />
			</Button>
		</div>
		<div bind:this={connectionsEl} class="flex grow flex-col gap-4 overflow-y-auto">
			<ItineraryList
				{baseQuery}
				{baseResponse}
				{routingResponses}
				selectItinerary={(selectedItinerary) => pushState('', { selectedItinerary })}
			/>
		</div>
	</div>
{/if}
