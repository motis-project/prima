<script lang="ts">
	import { PUBLIC_PROVIDER, PUBLIC_IMPRINT_URL, PUBLIC_PRIVACY_URL } from '$env/static/public';
	import { browser } from '$app/environment';
	import { goto, pushState, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount, tick } from 'svelte';

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

	import Meta from '$lib/ui/Meta.svelte';
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
	import { LocateFixed, MapIcon } from 'lucide-svelte';
	import { posToLocation } from '$lib/map/Location';
	import { MAX_MATCHING_DISTANCE } from '$lib/constants';
	import PopupMap from '$lib/ui/PopupMap.svelte';

	type LuggageType = 'none' | 'light' | 'heavy';

	const { form, data } = $props();

	const urlParams = browser ? new URLSearchParams(window.location.search) : undefined;

	let passengers = $state(1);
	let kidsZeroToTwo = $state(0);
	let kidsThreeToFour = $state(0);
	let kidsFiveToSix = $state(0);
	let maxKidsZeroToTwo = $derived(passengers - 1 - kidsThreeToFour - kidsFiveToSix);
	let maxKidsThreeToFour = $derived(passengers - 1 - kidsZeroToTwo - kidsFiveToSix);
	let maxKidsFiveToSix = $derived(passengers - 1 - kidsZeroToTwo - kidsThreeToFour);
	let minimumPassengers = $derived(1 + kidsZeroToTwo + kidsThreeToFour + kidsFiveToSix);
	let kids = $derived(kidsZeroToTwo + kidsThreeToFour + kidsFiveToSix);
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
						maxMatchingDistance: MAX_MATCHING_DISTANCE,
						maxTravelTime: 1440,
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

	onMount(async () => {
		await tick();
		applyPageStateFromURL();
	});

	const applyPageStateFromURL = () => {
		if (browser && urlParams) {
			if (urlParams.has('tripId')) {
				onClickTrip(urlParams.get('tripId')!, true);
			}
			if (urlParams.has('stopId')) {
				console.log(urlParams);
				const time = urlParams.has('time') ? new Date(urlParams.get('time')!) : new Date();
				onClickStop('', urlParams.get('stopId')!, time, true);
			}
		}
	};

	const onClickTrip = async (tripId: string, replace = false) => {
		const { data: itinerary, error } = await trip({ query: { tripId } });
		if (error) {
			alert(error);
			return;
		}
		const updateState = replace ? replaceState : pushState;
		updateState('', { selectedItinerary: itinerary });
	};

	const onClickStop = (name: string, stopId: string, time: Date, replace = false) => {
		const updateState = replace ? replaceState : pushState;
		updateState('', { stop: { name, stopId, time } });
	};

	const getLocation = () => {
		if (navigator && navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(applyPosition, (e) => console.log(e), {
				enableHighAccuracy: true
			});
		}
	};

	const applyPosition = (position: { coords: { latitude: number; longitude: number } }) => {
		from = posToLocation({ lat: position.coords.latitude, lon: position.coords.longitude }, 0);
	};

	let loading = $state(false);
</script>

<Meta title={PUBLIC_PROVIDER} />

<div class="md:min-h-[70dvh] md:w-96">
	<Message msg={form?.msg} class="mb-4" />

	{#if page.state.selectFrom}
		<AddressTypeahead
			placeholder={t.from}
			bind:selected={from}
			items={fromItems}
			onValueChange={() => pushState('', {})}
		/>
	{:else if page.state.selectTo}
		<AddressTypeahead
			placeholder={t.to}
			bind:selected={to}
			items={toItems}
			onValueChange={() => pushState('', {})}
		/>
	{:else if page.state.showMap}
		<PopupMap bind:from bind:to itinerary={page.state.selectedItinerary} areas={data.areas} />
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
								price={odmPrice(page.state.selectedItinerary, passengers, kids)}
							/>

							<p class="my-2 text-sm">{t.booking.disclaimer}</p>

							<Dialog.Footer>
								{@const firstOdmIndex = page.state.selectedItinerary.legs.findIndex(
									(l: Leg) => l.mode === 'ODM'
								)}
								{@const firstOdm =
									firstOdmIndex === -1
										? undefined
										: page.state.selectedItinerary.legs[firstOdmIndex]}
								{@const lastOdmIndex = page.state.selectedItinerary.legs.findLastIndex(
									(l: Leg) => l.mode === 'ODM'
								)}
								{@const lastOdm =
									lastOdmIndex === -1 ? undefined : page.state.selectedItinerary.legs[lastOdmIndex]}
								{@const isDirectODM =
									page.state.selectedItinerary.legs.length === 1 &&
									page.state.selectedItinerary.legs[0].mode === 'ODM'}

								<form
									method="post"
									action="?/bookItineraryWithOdm"
									use:enhance={() => {
										loading = true;
										return async ({ update }) => {
											await update();
											window.setTimeout(() => {
												loading = false;
											}, 5000);
										};
									}}
								>
									<input
										type="hidden"
										name="json"
										value={JSON.stringify(page.state.selectedItinerary)}
									/>
									<input
										type="hidden"
										name="startFixed1"
										value={isDirectODM
											? timeType === 'departure'
												? '1'
												: '0'
											: firstOdmIndex === 0
												? '0'
												: '1'}
									/>
									<input type="hidden" name="startFixed2" value="1" />
									<input type="hidden" name="fromAddress1" value={firstOdm.from.name} />
									<input type="hidden" name="toAddress1" value={firstOdm.to.name} />
									<input type="hidden" name="fromAddress2" value={lastOdm.from.name} />
									<input type="hidden" name="toAddress2" value={lastOdm.to.name} />
									<input type="hidden" name="fromLat1" value={firstOdm.from.lat} />
									<input type="hidden" name="fromLng1" value={firstOdm.from.lon} />
									<input type="hidden" name="toLat1" value={firstOdm.to.lat} />
									<input type="hidden" name="toLng1" value={firstOdm.to.lon} />
									<input type="hidden" name="fromLat2" value={lastOdm.from.lat} />
									<input type="hidden" name="fromLng2" value={lastOdm.from.lon} />
									<input type="hidden" name="toLat2" value={lastOdm.to.lat} />
									<input type="hidden" name="toLng2" value={lastOdm.to.lon} />
									<input
										type="hidden"
										name="startTime1"
										value={new Date(firstOdm.startTime).getTime()}
									/>
									<input
										type="hidden"
										name="endTime1"
										value={new Date(firstOdm.endTime).getTime()}
									/>
									<input
										type="hidden"
										name="startTime2"
										value={new Date(lastOdm.startTime).getTime()}
									/>
									<input
										type="hidden"
										name="endTime2"
										value={new Date(lastOdm.endTime).getTime()}
									/>
									<input type="hidden" name="passengers" value={passengers} />
									<input type="hidden" name="kidsZeroToTwo" value={kidsZeroToTwo} />
									<input type="hidden" name="kidsThreeToFour" value={kidsThreeToFour} />
									<input type="hidden" name="kidsFiveToSix" value={kidsFiveToSix} />
									<input type="hidden" name="luggage" value={luggageToInt(luggage)} />
									<input type="hidden" name="wheelchairs" value={wheelchair ? 1 : 0} />
									<Button type="submit" variant="outline" disabled={loading}
										>{t.booking.header}</Button
									>
								</form>
							</Dialog.Footer>
						</Dialog.Content>
					</Dialog.Root>
				{:else}
					<Button href="/account" variant="outline">{t.booking.loginToBook}</Button>
				{/if}
			{:else}
				<form method="post" action="?/storeItineraryWithNoOdm" class="flex grow">
					<input type="hidden" name="json" value={JSON.stringify(page.state.selectedItinerary)} />
					<Button type="submit" class="grow">{t.storeItinerary}</Button>
				</form>
			{/if}
			<Button
				size="icon"
				variant="outline"
				onclick={() =>
					pushState('', { showMap: true, selectedItinerary: page.state.selectedItinerary })}
			>
				<MapIcon class="h-[1.2rem] w-[1.2rem]" />
			</Button>
		</div>
		<Separator class="my-4" />
		<ConnectionDetail itinerary={page.state.selectedItinerary} {onClickStop} {onClickTrip} />
	{:else if page.state.stop}
		<Button variant="outline" size="icon" onclick={() => window.history.back()}>
			<ChevronLeft />
		</Button>
		<StopTimes
			arriveBy={false}
			time={page.state.stop.time}
			stopId={page.state.stop.stopId}
			{onClickTrip}
		/>
	{/if}
	<div
		class="contents"
		class:hidden={page.state.stop ||
			page.state.selectedItinerary ||
			page.state.selectFrom ||
			page.state.selectTo}
	>
		<div class="flex h-full flex-col gap-4">
			<Button
				size="icon"
				variant="outline"
				onclick={() => pushState('', { showMap: true })}
				class="ml-auto"
			>
				<MapIcon class="h-[1.2rem] w-[1.2rem]" />
			</Button>
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
					variant="ghost"
					class="absolute right-0 top-0 z-10"
					size="icon"
					onclick={() => getLocation()}
				>
					<LocateFixed class="h-5 w-5" />
				</Button>
				<Button
					class="absolute right-10 top-6 z-10 rounded-full"
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
						<label>
							<input type="radio" name="timetype" value="departure" bind:group={timeType} />
							{t.departure}
						</label>
						<label>
							<input type="radio" name="timetype" value="arrival" bind:group={timeType} />
							{t.arrival}
						</label>
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
							<Label>{t.booking.passengerNumber}</Label>
							<Input type="number" bind:value={passengers} min={minimumPassengers} max="6" />
							<Label class="col-span-2">{t.booking.kidsDescription}</Label>
							<Label>{t.booking.kidsZeroToTwo}</Label>
							<Input type="number" bind:value={kidsZeroToTwo} min="0" max={maxKidsZeroToTwo} />
							<Label>{t.booking.kidsThreeToFour}</Label>
							<Input type="number" bind:value={kidsThreeToFour} min="0" max={maxKidsThreeToFour} />
							<Label>{t.booking.kidsFiveToSix}</Label>
							<Input type="number" bind:value={kidsFiveToSix} min="0" max={maxKidsFiveToSix} />

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
			<div class="flex grow flex-col gap-4">
				<ItineraryList
					{baseQuery}
					{baseResponse}
					{routingResponses}
					{passengers}
					{kids}
					selectItinerary={(selectedItinerary) => {
						goto('?detail', { state: { selectedItinerary } });
					}}
					updateStartDest={updateStartDest(from, to)}
				/>
			</div>
			<div class="mx-auto mt-6 space-y-2 text-sm">
				<p><strong>{t.fare}</strong><br />3€ {t.perPerson} {t.perRide}</p>
				<p><strong>{t.bookingDeadline}</strong><br />{t.bookingDeadlineContent}</p>
				<p>
					<button
						class="link"
						onclick={() =>
							pushState('', { showMap: true, selectedItinerary: page.state.selectedItinerary })}
						><strong>{t.serviceArea}</strong></button
					><br />{t.regionAround} Bad Muskau, Boxberg/O.L., Gablenz, Groß Düben, Krauschwitz, Schleife,
					Trebendorf, Weißkeißel, Weißwasser/O.L.
				</p>
				<p><strong>{t.serviceTime}</strong><br />{t.serviceTimeContent}</p>
			</div>
			<p class="mx-auto mt-6 text-sm">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html t.introduction}
			</p>
		</div>
		<p class="mx-auto mt-6 max-w-72 text-center text-xs text-input">
			<a
				href={PUBLIC_IMPRINT_URL}
				target="_blank"
				class="whitespace-nowrap border-b border-dotted border-input">{t.account.imprint}</a
			>
			|
			<a href={PUBLIC_PRIVACY_URL} class="whitespace-nowrap border-b border-dotted border-input"
				>{t.account.privacy_short}</a
			>
		</p>
	</div>
</div>
