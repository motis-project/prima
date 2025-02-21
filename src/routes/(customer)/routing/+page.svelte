<script lang="ts">
	import { browser } from '$app/environment';
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	import ArrowUpDown from 'lucide-svelte/icons/arrow-up-down';
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';
	import ChevronRight from 'lucide-svelte/icons/chevron-right';
	import ChevronDown from 'lucide-svelte/icons/chevron-down';
	import NoLuggageIcon from 'lucide-svelte/icons/circle-slash-2';
	import LuggageIcon from 'lucide-svelte/icons/luggage';
	import WheelchairIcon from 'lucide-svelte/icons/accessibility';
	import PersonIcon from 'lucide-svelte/icons/user';

	import Separator from '$lib/shadcn/separator/separator.svelte';
	import * as RadioGroup from '$lib/shadcn/radio-group';
	import { Input } from '$lib/shadcn/input';
	import { Label } from '$lib/shadcn/label';

	import { plan, trip, type Leg, type Match, type PlanData, type PlanResponse } from '$lib/openapi';

	import { t } from '$lib/i18n/translation';
	import { lngLatToStr } from '$lib/util/lngLatToStr';

	import AddressTypeahead from '$lib/ui/AddressTypeahead.svelte';
	import { type Location } from '$lib/ui/AddressTypeahead.svelte';

	import ItineraryList from './ItineraryList.svelte';
	import ConnectionDetail from './ConnectionDetail.svelte';
	import StopTimes from './StopTimes.svelte';
	import { enhance } from '$app/forms';
	import Message from '$lib/ui/Message.svelte';
	import DateInput from './DateInput.svelte';
	import { Button, buttonVariants } from '$lib/shadcn/button';
	import * as Dialog from '$lib/shadcn/dialog';
	import type { TimeType } from '$lib/util/TimeType';
	import Switch from '$lib/shadcn/switch/switch.svelte';
	import { cn } from '$lib/shadcn/utils';
	import { updateStartDest } from '$lib/util/updateStartDest';
	import { odmPrice } from '$lib/util/odmPrice';
	import BookingSummary from '$lib/ui/BookingSummary.svelte';

	type LuggageType = 'none' | 'light' | 'heavy';

	const { form, data } = $props();

	const urlParams = browser ? new URLSearchParams(window.location.search) : undefined;

	let passengers = $state(1);
	let wheelchair = $state(false);
	let luggage = $state<LuggageType>('none');
	let time = $state<Date>(new Date());
	let timeType = $state<TimeType>('departure');
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

	const luggageToInt = (str: LuggageType) => {
		switch (str) {
			case 'heavy':
				return 3;
			case 'light':
				return 1;
			case 'none':
				return 0;
		}
	};
	const toPlaceString = (l: Location) => {
		if (l.value.match?.level) {
			return `${lngLatToStr(l.value.match!)},${l.value.match.level}`;
		} else {
			return `${lngLatToStr(l.value.match!)},0`;
		}
	};
	let baseQuery = $derived(
		from.value.match && to.value.match
			? ({
					query: {
						time: time.toISOString(),
						arriveBy: timeType === 'arrival',
						fromPlace: toPlaceString(from),
						toPlace: toPlaceString(to),
						preTransitModes: ['WALK', 'ODM'],
						postTransitModes: ['WALK', 'ODM'],
						directModes: ['WALK', 'ODM'],
						luggage: luggageToInt(luggage),
						fastestDirectFactor: 1.6,
						passengers
					}
				} as PlanData)
			: undefined
	);

	type Timeout = ReturnType<typeof setTimeout>;
	let baseResponse = $state<Promise<PlanResponse | undefined>>();
	let routingResponses = $state<Array<Promise<PlanResponse | undefined>>>([]);
	let searchDebounceTimer: Timeout;
	$effect(() => {
		if (baseQuery) {
			clearTimeout(searchDebounceTimer);
			searchDebounceTimer = setTimeout(() => {
				const base = plan<true>(baseQuery).then(updateStartDest(from, to));
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

<div class="md:h-[80%] md:w-96">
	<Message msg={form?.msg} class="mb-4" />

	{#if page.state.selectFrom}
		<AddressTypeahead
			placeholder={t.from}
			bind:selected={from}
			items={fromItems}
			onValueChange={() => history.back()}
		/>
	{:else if page.state.selectTo}
		<AddressTypeahead
			placeholder={t.to}
			bind:selected={to}
			items={toItems}
			onValueChange={() => history.back()}
		/>
	{:else if page.state.selectedItinerary}
		<div class="flex items-center justify-between gap-4">
			<Button variant="outline" size="icon" onclick={() => window.history.back()}>
				<ChevronLeft />
			</Button>

			{#if page.state.selectedItinerary.legs.some((l: Leg) => l.mode === 'ODM')}
				{#if data.isLoggedIn}
					<Dialog.Root>
						<Dialog.Trigger class={cn(buttonVariants({ variant: 'default' }), 'grow')}>
							{t.booking.header}
							<ChevronRight />
						</Dialog.Trigger>
						<Dialog.Content class="w-[90%] flex-col md:w-96">
							<Dialog.Header>
								<Dialog.Title>{t.booking.header}</Dialog.Title>
							</Dialog.Header>

							<BookingSummary
								{passengers}
								{wheelchair}
								luggage={luggageToInt(luggage)}
								price={odmPrice(page.state.selectedItinerary, passengers)}
							/>

							<p class="my-2 text-sm">{t.booking.disclaimer}</p>

							<Dialog.Footer>
								{@const first = page.state.selectedItinerary.legs.find(
									(l: Leg) => l.mode === 'ODM'
								)}
								{@const last = page.state.selectedItinerary.legs.findLast(
									(l: Leg) => l.mode === 'ODM'
								)}
								{@const isSpecial = (stopName: string) =>
									stopName === 'START' || stopName === 'END'}
								<form method="post" use:enhance>
									<input
										type="hidden"
										name="json"
										value={JSON.stringify(page.state.selectedItinerary)}
									/>
									<input
										type="hidden"
										name="startFixed1"
										value={isSpecial(first.from.name) ? '1' : '0'}
									/>
									<input
										type="hidden"
										name="startFixed2"
										value={isSpecial(last.to.name) ? '1' : '0'}
									/>
									<input
										type="hidden"
										name="fromAddress1"
										value={isSpecial(first.from.name) ? from.label : first.from.name}
									/>
									<input
										type="hidden"
										name="toAddress1"
										value={isSpecial(first.to.name) ? to.label : first.to.name}
									/>
									<input
										type="hidden"
										name="fromAddress2"
										value={isSpecial(last.from.name) ? from.label : last.from.name}
									/>
									<input
										type="hidden"
										name="toAddress2"
										value={isSpecial(last.to.name) ? to.label : last.to.name}
									/>
									<input type="hidden" name="fromLat1" value={first.from.lat} />
									<input type="hidden" name="fromLng1" value={first.from.lon} />
									<input type="hidden" name="toLat1" value={first.to.lat} />
									<input type="hidden" name="toLng1" value={first.to.lon} />
									<input type="hidden" name="fromLat2" value={last.from.lat} />
									<input type="hidden" name="fromLng2" value={last.from.lon} />
									<input type="hidden" name="toLat2" value={last.to.lat} />
									<input type="hidden" name="toLng2" value={last.to.lon} />
									<input
										type="hidden"
										name="startTime1"
										value={new Date(first.startTime).getTime()}
									/>
									<input type="hidden" name="endTime1" value={new Date(first.endTime).getTime()} />
									<input
										type="hidden"
										name="startTime2"
										value={new Date(last.startTime).getTime()}
									/>
									<input type="hidden" name="endTime2" value={new Date(last.endTime).getTime()} />
									<input type="hidden" name="passengers" value={passengers} />
									<input type="hidden" name="luggage" value={luggageToInt(luggage)} />
									<input type="hidden" name="wheelchairs" value={wheelchair ? 1 : 0} />
									<Button type="submit" variant="outline">{t.booking.header}</Button>
								</form>
							</Dialog.Footer>
						</Dialog.Content>
					</Dialog.Root>
				{:else}
					<Button href="/account" variant="outline">{t.booking.loginToBook}</Button>
				{/if}
			{/if}
		</div>
		<Separator class="my-4" />
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
			<div class="flex gap-2">
				<Dialog.Root>
					<Dialog.Trigger class={cn(buttonVariants({ variant: 'default' }), 'grow')}>
						{t.atDateTime(
							timeType,
							time,
							time.toLocaleDateString() == new Date().toLocaleDateString()
						)}
						<ChevronDown />
					</Dialog.Trigger>
					<Dialog.Content class="flex-col sm:max-w-[425px]">
						<RadioGroup.Root class="flex" bind:value={timeType}>
							<Label
								for="departure"
								class="flex items-center rounded-md border-2 border-muted bg-popover p-1 px-2 hover:cursor-pointer hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-blue-600"
							>
								<RadioGroup.Item
									value="departure"
									id="departure"
									class="sr-only"
									aria-label={t.departure}
								/>
								<span>{t.departure}</span>
							</Label>
							<Label
								for="arrival"
								class="flex items-center rounded-md border-2 border-muted bg-popover p-1 px-2 hover:cursor-pointer hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-blue-600"
							>
								<RadioGroup.Item
									value="arrival"
									id="arrival"
									class="sr-only"
									aria-label={t.arrival}
								/>
								<span>{t.arrival}</span>
							</Label>
						</RadioGroup.Root>
						<DateInput bind:value={time} />
					</Dialog.Content>
				</Dialog.Root>
				<Dialog.Root>
					<Dialog.Trigger class={buttonVariants({ variant: 'default' })}>
						<span class="flex items-center">
							{passengers === 1 ? '' : passengers}
							<PersonIcon />
							{#if luggage == 'light'}
								+ <LuggageIcon />
							{/if}
							{#if luggage == 'heavy'}
								+ <LuggageIcon />
								<LuggageIcon />
							{/if}
							{#if wheelchair}
								+ <WheelchairIcon />
							{/if}
						</span>
						<ChevronDown />
					</Dialog.Trigger>
					<Dialog.Content class="w-[90%] flex-col md:max-w-[28rem]">
						<Dialog.Header>
							<Dialog.Title>{t.bookingInfo}</Dialog.Title>
							<Dialog.Description>
								{t.changeBookingInfo}
							</Dialog.Description>
						</Dialog.Header>

						<div class="md-4 grid grid-cols-2 grid-rows-2 items-center gap-4">
							<Label>Anzahl Personen</Label>
							<Input type="number" bind:value={passengers} min="1" max="6" />

							<Label class="flex items-center gap-2">
								<WheelchairIcon class="size-5 shrink-0" />
								{t.booking.foldableWheelchair}
							</Label>
							<Switch class="justify-self-end" bind:checked={wheelchair} />
						</div>

						<RadioGroup.Root bind:value={luggage} class="grid grid-cols-3 gap-4">
							<Label
								for="none"
								class="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-muted bg-popover p-4 text-center leading-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
							>
								<RadioGroup.Item value="none" id="none" class="sr-only" aria-label="none" />
								<NoLuggageIcon />
								{t.booking.noLuggage}
							</Label>
							<Label
								for="light"
								class="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-muted bg-popover p-4 text-center leading-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
							>
								<RadioGroup.Item value="light" id="light" class="sr-only" aria-label="light" />
								<LuggageIcon />
								{t.booking.handLuggage}
							</Label>
							<Label
								for="heavy"
								class="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-muted bg-popover p-4 text-center leading-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
							>
								<RadioGroup.Item value="heavy" id="heavy" class="sr-only" aria-label="heavy" />
								<div class="flex">
									<LuggageIcon />
									<LuggageIcon />
								</div>
								{t.booking.heavyLuggage}
							</Label>
						</RadioGroup.Root>
					</Dialog.Content>
				</Dialog.Root>
			</div>
			<div bind:this={connectionsEl} class="flex grow flex-col gap-4 overflow-y-auto">
				<ItineraryList
					{baseQuery}
					{baseResponse}
					{routingResponses}
					{passengers}
					selectItinerary={(selectedItinerary) => pushState('', { selectedItinerary })}
					updateStartDest={updateStartDest(from, to)}
				/>
			</div>
		</div>
	{/if}
</div>
