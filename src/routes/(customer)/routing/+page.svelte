<script lang="ts">
	import { PUBLIC_INFO_URL, PUBLIC_PROVIDER } from '$env/static/public';
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
	import { trip, type Match, type PlanData } from '$lib/openapi';
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
	import { getEuroString, legOdmPrice, odmPrice } from '$lib/util/odmPrice';
	import BookingSummary from '$lib/ui/BookingSummary.svelte';
	import { HelpCircleIcon, LocateFixed, MapIcon } from 'lucide-svelte';
	import { posToLocation } from '$lib/map/Location';
	import { BOOKING_MAX_PASSENGERS, MAX_MATCHING_DISTANCE } from '$lib/constants';
	import PopupMap from '$lib/ui/PopupMap.svelte';
	import { planAndSign, type SignedPlanResponse } from '$lib/planAndSign';
	import logo from '$lib/assets/logo-alpha.png';
	import Footer from '$lib/ui/Footer.svelte';
	import { isOdmLeg, isRideShareLeg } from '$lib/util/booking/checkLegType';
	import PlusMinus from '$lib/ui/PlusMinus.svelte';

	type LuggageType = 'none' | 'light' | 'heavy';

	const { form, data } = $props();

	const urlParams = browser ? new URLSearchParams(window.location.search) : undefined;

	let kidsZeroToTwo = $state(0);
	let kidsThreeToFour = $state(0);
	let kidsFiveToSix = $state(0);
	let kidsSevenToFourteen = $state(0);
	let fourteenPlus = $state(1);
	let passengers = $derived(
		fourteenPlus + kidsSevenToFourteen + kidsFiveToSix + kidsThreeToFour + kidsZeroToTwo
	);
	let remainingPassengers = $derived(BOOKING_MAX_PASSENGERS - passengers);
	let fourteenPlusMin = $derived(
		kidsZeroToTwo > 0 || kidsThreeToFour > 0 || kidsFiveToSix > 0 || kidsSevenToFourteen == 0
			? 1
			: 0
	);
	let kidsSevenToFourteenMin = $derived(fourteenPlus == 0 ? 1 : 0);
	function max(value: number) {
		return remainingPassengers + value;
	}
	function underSevenMax(value: number) {
		return fourteenPlus < 1 ? 0 : max(value);
	}

	let freeKids = $derived(kidsZeroToTwo + kidsThreeToFour + kidsFiveToSix);
	let wheelchair = $state(false);
	let luggage = $state<LuggageType>('none');
	let time = $state<Date>(new Date(urlParams?.get('time') || Date.now()));
	let timeType = $state<TimeType>(urlParams?.get('arriveBy') == 'true' ? 'arrival' : 'departure');
	let fromParam: Match | undefined = undefined;
	let toParam: Match | undefined = undefined;
	if (browser && urlParams && urlParams.has('from') && urlParams.has('to')) {
		fromParam = JSON.parse(urlParams.get('from') ?? '') ?? {};
		toParam = JSON.parse(urlParams.get('to') ?? '') ?? {};
	}
	let fromMatch = { match: fromParam };
	let toMatch = { match: toParam };
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

	const pushStateWithQueryString = (
		// eslint-disable-next-line
		queryParams: Record<string, any>,
		// eslint-disable-next-line
		newState: App.PageState,
		replace: boolean = false
	) => {
		const params = new URLSearchParams(queryParams);
		const updateState = replace ? replaceState : pushState;
		updateState('?' + params.toString(), newState);
	};

	let baseQuery = $derived(
		from.value.match && to.value.match
			? ({
					time: time.toISOString(),
					arriveBy: timeType === 'arrival',
					fromPlace: toPlaceString(from),
					toPlace: toPlaceString(to),
					preTransitModes: ['WALK', 'ODM', 'RIDE_SHARING'],
					postTransitModes: ['WALK', 'ODM', 'RIDE_SHARING'],
					directModes: ['WALK', 'ODM', 'RIDE_SHARING'],
					luggage: luggageToInt(luggage),
					fastestDirectFactor: 1.6,
					maxMatchingDistance: MAX_MATCHING_DISTANCE,
					maxTravelTime: 1440,
					passengers
				} as PlanData['query'])
			: undefined
	);

	type Timeout = ReturnType<typeof setTimeout>;
	let baseResponse = $state<Promise<SignedPlanResponse | undefined>>();
	let routingResponses = $state<Array<Promise<SignedPlanResponse | undefined>>>([]);
	let searchDebounceTimer: Timeout;
	$effect(() => {
		if (baseQuery) {
			clearTimeout(searchDebounceTimer);
			searchDebounceTimer = setTimeout(() => {
				const base = planAndSign(baseQuery).then(updateStartDest(from, to));
				baseResponse = base;
				routingResponses = [base];
				pushStateWithQueryString(
					{
						from: JSON.stringify(from?.value?.match),
						to: JSON.stringify(to?.value?.match),
						time: time,
						arriveBy: timeType === 'arrival'
					},
					{ showMap: page.state.showMap },
					true
				);
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
			open={true}
			onValueChange={() => pushState('', {})}
		/>
	{:else if page.state.selectTo}
		<AddressTypeahead
			placeholder={t.to}
			bind:selected={to}
			items={toItems}
			open={true}
			onValueChange={() => pushState('', {})}
		/>
	{:else if page.state.showMap}
		<PopupMap
			bind:from
			bind:to
			itinerary={page.state.selectedItinerary}
			areas={data.areas}
			rideSharingBounds={data.rideSharingBounds}
		/>
	{:else if page.state.selectedItinerary}
		<div class="flex items-center justify-between gap-4">
			<Button variant="outline" size="icon" onclick={() => window.history.back()}>
				<ChevronLeft />
			</Button>
			{#if page.state.selectedItinerary.legs.some(isOdmLeg)}
				{#if data.isLoggedIn}
					{@const rideShareLeg = page.state.selectedItinerary.legs.find(isRideShareLeg)}
					{#if !(rideShareLeg && data.user.ownRideShareOfferIds?.some((offer) => offer.id === JSON.parse(rideShareLeg.tripId!)?.tour))}
						<Dialog.Root>
							<Dialog.Trigger class={cn(buttonVariants({ variant: 'default' }), 'grow')}>
								{rideShareLeg ? t.ride.negotiateHeader : t.booking.header}
								<ChevronRight />
							</Dialog.Trigger>
							<Dialog.Content class="max-h-[100vh] w-[90%] flex-col overflow-y-auto md:w-96">
								{#if rideShareLeg}
									<Dialog.Header>
										<Dialog.Title>{t.ride.negotiateHeader}</Dialog.Title>
									</Dialog.Header>

									<BookingSummary
										{passengers}
										{wheelchair}
										luggage={luggageToInt(luggage)}
										price={undefined}
									/>

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
										<p class="my-2 text-sm">{t.ride.negotiatePrivacy}</p>
										<ul class="flex list-inside list-disc flex-col gap-2">
											<li>{t.ride.startAndEnd}</li>
											<li>{t.ride.profile}</li>
											<li>{t.ride.email}: {data.user.email}</li>
											{#if data.user.phone}
												<li>{t.ride.phone}: {data.user.phone}</li>
											{/if}
										</ul>
										<p class="my-2 text-sm">
											{t.ride.negotiateExplanation}
											{#if !data.user.phone}
												{t.ride.noPhone}
											{/if}
										</p>
										<Dialog.Footer>
											<input
												type="hidden"
												name="json"
												value={JSON.stringify(page.state.selectedItinerary)}
											/>
											<input type="hidden" name="passengers" value={passengers} />
											<input type="hidden" name="fourTeenPlus" value={fourteenPlus} />
											<input type="hidden" name="kidsZeroToTwo" value={kidsZeroToTwo} />
											<input type="hidden" name="kidsThreeToFour" value={kidsThreeToFour} />
											<input type="hidden" name="kidsFiveToSix" value={kidsFiveToSix} />
											<input type="hidden" name="kidsSevenToFourteen" value={kidsSevenToFourteen} />
											<input type="hidden" name="luggage" value={luggageToInt(luggage)} />
											<input type="hidden" name="wheelchairs" value={wheelchair ? 1 : 0} />
											<input
												type="hidden"
												name="startFixed"
												value={timeType === 'departure' ? '1' : '0'}
											/>
											<Button type="submit" variant="outline" disabled={loading}
												>{t.ride.sendNegotiationRequest}</Button
											>
										</Dialog.Footer>
									</form>
								{:else}
									<Dialog.Header>
										<Dialog.Title>{t.booking.header}</Dialog.Title>
									</Dialog.Header>

									<BookingSummary
										{passengers}
										{wheelchair}
										luggage={luggageToInt(luggage)}
										price={odmPrice(
											page.state.selectedItinerary,
											passengers,
											freeKids,
											kidsSevenToFourteen
										)}
									/>

									<p class="my-2 text-sm">{t.booking.disclaimer}</p>

									<Dialog.Footer>
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
											<input type="hidden" name="passengers" value={passengers} />
											<input type="hidden" name="fourTeenPlus" value={fourteenPlus} />
											<input type="hidden" name="kidsZeroToTwo" value={kidsZeroToTwo} />
											<input type="hidden" name="kidsThreeToFour" value={kidsThreeToFour} />
											<input type="hidden" name="kidsFiveToSix" value={kidsFiveToSix} />
											<input type="hidden" name="kidsSevenToFourteen" value={kidsSevenToFourteen} />
											<input type="hidden" name="luggage" value={luggageToInt(luggage)} />
											<input type="hidden" name="wheelchairs" value={wheelchair ? 1 : 0} />
											<input
												type="hidden"
												name="startFixed"
												value={timeType === 'departure' ? '1' : '0'}
											/>
											<Button type="submit" variant="outline" disabled={loading}
												>{t.booking.header}</Button
											>
										</form>
									</Dialog.Footer>
								{/if}
							</Dialog.Content>
						</Dialog.Root>
					{/if}
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
			<div class="grid grid-cols-2 gap-4">
				<div class="relative flex">
					<img class="w-1/2" src={logo} alt={t.logo} />
					<p class="absolute bottom-0 right-0 font-bold">PriMa+ÖV</p>
				</div>
				<div class="relative" dir="rtl">
					<div class="absolute bottom-0">
						<Button
							size="icon"
							variant="outline"
							onclick={() => pushState('', { showMap: true })}
							class="ml-auto"
						>
							<MapIcon class="h-[1.2rem] w-[1.2rem]" />
						</Button>
						<Button
							size="icon"
							variant="outline"
							class="ml-auto"
							onclick={() => goto('/explainer')}
						>
							<HelpCircleIcon class="h-[1.2rem] w-[1.2rem]" />
						</Button>
					</div>
				</div>
			</div>
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

						<div class="grid grid-cols-2 items-center gap-4">
							<Label class="justify-self-end">{t.booking.passengerNumber}</Label>
							<span class="flex items-center justify-self-center"
								>{passengers}<PersonIcon class="size-5 shrink-0" /></span
							>
							<Label class="justify-self-end">{t.booking.fifteenPlus}</Label>
							<PlusMinus
								classes="justify-self-center"
								bind:value={fourteenPlus}
								min={fourteenPlusMin}
								max={max(fourteenPlus)}
								step={1}
							/>
							<Label class="justify-self-end">{t.booking.kidsSevenToFourteen}</Label>
							<PlusMinus
								classes="justify-self-center"
								bind:value={kidsSevenToFourteen}
								min={kidsSevenToFourteenMin}
								max={max(kidsSevenToFourteen)}
								step={1}
							/>
							<Label class="justify-self-end">{t.booking.kidsFiveToSix}</Label>
							<PlusMinus
								classes="justify-self-center"
								bind:value={kidsFiveToSix}
								min={0}
								max={underSevenMax(kidsFiveToSix)}
								step={1}
							/>
							<Label class="justify-self-end">{t.booking.kidsThreeToFour}</Label>
							<PlusMinus
								classes="justify-self-center"
								bind:value={kidsThreeToFour}
								min={0}
								max={underSevenMax(kidsThreeToFour)}
								step={1}
							/>
							<Label class="justify-self-end">{t.booking.kidsZeroToTwo}</Label>
							<PlusMinus
								classes="justify-self-center"
								bind:value={kidsZeroToTwo}
								min={0}
								max={underSevenMax(kidsZeroToTwo)}
								step={1}
							/>
							<Label class="flex items-center justify-self-end">
								<WheelchairIcon class="size-5 shrink-0" />
								{t.booking.foldableWheelchair}
							</Label>
							<Switch class="ml-4 justify-self-center" bind:checked={wheelchair} />
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
					freePassengers={freeKids}
					reducedPassengers={kidsSevenToFourteen}
					selectItinerary={(selectedItinerary) => {
						goto('?detail', { state: { selectedItinerary } });
					}}
					updateStartDest={updateStartDest(from, to)}
				/>
			</div>
			<div class="border-rounded-md mx-auto w-full space-y-2 rounded-md border-2 border-solid p-2">
				<p class="text-md font-bold">{t.publicTransitTaxi}</p>
				<hr />
				<div class="space-y-2 text-sm">
					<strong>{t.fare}</strong>
					<div class="grid grid-cols-2">
						<div>{t.booking.fifteenPlus}</div>
						<div>{getEuroString(legOdmPrice(1, 0, 0))}</div>
						<div>{t.booking.kidsSevenToFourteen}</div>
						<div>{getEuroString(legOdmPrice(1, 0, 1))}</div>
						<div>{t.booking.underSeven}</div>
						<div>{getEuroString(legOdmPrice(1, 1, 0))}</div>
						<div></div>
						<div>{t.perPerson} {t.perRide}</div>
					</div>
					<p><strong>{t.bookingDeadline}</strong><br />{t.bookingDeadlineContent}</p>
					<p>
						<button
							class="link"
							onclick={() =>
								pushState('', { showMap: true, selectedItinerary: page.state.selectedItinerary })}
							><strong>{t.serviceArea}</strong></button
						><br />{t.regionAround} Görlitz, Niesky, Weißwasser/O.L., Zittau.
					</p>
					<p><strong>{t.serviceTime}</strong><br />{t.serviceTimeContent}</p>
				</div>
			</div>

			<div class="border-rounded-md mx-auto w-full space-y-2 rounded-md border-2 border-solid p-2">
				<p class="text-md font-bold">{t.rideSharing}</p>
				<hr />
				<div class="space-y-2 text-sm">
					{t.rideSharingInfo}
				</div>
			</div>

			<p class="mx-auto mt-6 text-sm">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{t.introduction}
				<a href={PUBLIC_INFO_URL} class="link" target="_blank">{PUBLIC_PROVIDER}</a>
			</p>
		</div>
		<Footer />
	</div>
</div>
