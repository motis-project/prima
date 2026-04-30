<script lang="ts">
	import { Button, buttonVariants } from '$lib/shadcn/button';
	import { cn } from '$lib/shadcn/utils';
	import { pushState, replaceState } from '$app/navigation';
	import Message from '$lib/ui/Message.svelte';
	import { type Msg } from '$lib/msg';
	import { t } from '$lib/i18n/translation';
	import {
		ArrowUpDown,
		MapPin,
		MapPinCheckInside,
		EllipsisVertical,
		ChevronRightIcon,
		LoaderCircle,
		LocateFixed,
		MapIcon,
		Plus,
		Car,
		CalendarDays,
		Clock,
		Users,
		Luggage
	} from 'lucide-svelte';
	import PopupMap from '$lib/ui/PopupMap.svelte';
	import { page } from '$app/state';
	import { type Location } from '$lib/map/Location';
	import AddressTypeahead from '$lib/ui/AddressTypeahead.svelte';
	import { Input } from '$lib/shadcn/input';
	import { Label } from '$lib/shadcn/label';
	import DateInput from '../../routing/DateInput.svelte';
	import * as Popover from '$lib/shadcn/popover';
	import * as RadioGroup from '$lib/shadcn/radio-group';
	import { type TimeType } from '$lib/util/TimeType';
	import { posToLocation } from '$lib/map/Location';
	import Time from '../../routing/Time.svelte';
	import { formatDurationSec } from '../../routing/formatDuration';
	import maplibregl from 'maplibre-gl';
	import type { Itinerary } from '$lib/openapi';
	import { enhance } from '$app/forms';
	import { DAY, HOUR } from '$lib/util/time';
	import { storeLastPageAndGoto } from '$lib/util/storeLastPageAndGoto';
	import PlusMinus from '$lib/ui/PlusMinus.svelte';
	import { LOCALE, TZ } from '$lib/constants';
	import { CalendarDate, fromDate, toCalendarDate } from '@internationalized/date';
	import RepetitionSelector from '$lib/ui/RepetitionSelector.svelte';
	import * as Card from '$lib/shadcn/card';

	const { data, form } = $props();

	let msg = $state<Msg | undefined>();
	let fromItems = $state<Array<Location>>([]);
	let toItems = $state<Array<Location>>([]);
	let from = $state<Location>({
		label: '',
		value: {}
	});
	let to = $state<Location>({
		label: '',
		value: {}
	});

	let time = $state<Date>(new Date(Date.now() + HOUR * 2));
	let timeType = $state<TimeType>('departure');

	let passengers = $state(0);
	let luggage = $state(0);
	let vehicle = $state<string>(data.vehicles[0].id.toString());
	$effect(() => {
		passengers = data.vehicles.find((v) => v.id.toString() == vehicle)?.passengers ?? 3;
		luggage = data.vehicles.find((v) => v.id.toString() == vehicle)?.luggage ?? 3;
	});

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

	type Timeout = ReturnType<typeof setTimeout>;
	let searchDebounceTimer: Timeout;
	let loading = $state(false);
	let range: {
		start: CalendarDate;
		end: CalendarDate;
	} = $state({
		start: toCalendarDate(fromDate(new Date(Date.now() + HOUR * 2), TZ)),
		end: toCalendarDate(fromDate(new Date(Date.now() + DAY * 30), TZ))
	});

	let offerMode = $state<'single' | 'repeating'>('single');
	let selectedDays: boolean[] = $state(Array.from(t.ride.daysList, (_) => false));
	let selectedDayMask = $derived(
		selectedDays.reduce((mask, val, i) => (val ? mask | (1 << i) : mask), 0)
	);
	let bitDays = $derived(offerMode === 'repeating' ? selectedDayMask : 0);
	function formatCalendarDate(date: CalendarDate | undefined) {
		return date?.toDate(TZ).toLocaleDateString(LOCALE) ?? '';
	}

	let repetitionTimeRangeString = $derived(
		`${formatCalendarDate(range.start)} ${t.ride.to}${formatCalendarDate(range.end)}`
	);
	let repetitionSummary = $derived.by(() => {
		if (selectedDayMask === 0) {
			return t.ride.noDaysSelected;
		}
		if (!selectedDays.some((d) => !d)) {
			return `${t.daily} ${repetitionTimeRangeString}`;
		}
		return selectedDays
			.map((selected, index) => (selected ? t.ride.daysList[index].full : undefined))
			.filter((day) => day !== undefined)
			.join(', ')
			.concat(` ${repetitionTimeRangeString}`);
	});

	function activateOfferMode(mode: 'single' | 'repeating') {
		offerMode = mode;
	}

	function handleOfferModeKeydown(event: KeyboardEvent, mode: 'single' | 'repeating') {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			activateOfferMode(mode);
		}
	}

	function offerCardClass(active: boolean) {
		return cn(
			'cursor-pointer border-input transition-colors hover:bg-accent/40',
			active
				? 'border-blue-600 ring-1 ring-blue-600'
				: 'bg-muted/30 text-muted-foreground opacity-65'
		);
	}

	$effect(() => {
		if (from.value.match && to.value.match && vehicle && time && timeType) {
			loading = true;
			msg = undefined;
			clearTimeout(searchDebounceTimer);
			searchDebounceTimer = setTimeout(() => {
				fetch('/api/rideShareTimes', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						time: time.getTime(),
						startFixed: timeType != 'arrival',
						vehicle: parseInt(vehicle!),
						start: maplibregl.LngLat.convert(from.value.match!),
						end: maplibregl.LngLat.convert(to.value.match!)
					})
				})
					.then(function (response) {
						return response.json();
					})
					.then((j) => {
						if (!j || !j.end || !j.start) {
							msg = { type: 'error', text: 'noRouteFound' };
							loading = false;
							replaceState('', {});
							return;
						}
						const it: Itinerary = {
							duration: (j!.end - j!.start) / 1000,
							startTime: new Date(j!.start).toISOString(),
							endTime: new Date(j!.end).toISOString(),
							legs: [],
							transfers: 0
						};
						replaceState('', { selectedItinerary: it });
						loading = false;
					})
					.catch(() => {
						msg = { type: 'error', text: 'routingRequestFailed' };
						replaceState('', {});
						loading = false;
					});
			}, 400);
		}
	});
</script>

{#snippet timeControls(idPrefix: string)}
	<RadioGroup.Root class="grid grid-cols-2 gap-3" bind:value={timeType}>
		<Label
			for="{idPrefix}-departure"
			class="flex grow justify-center rounded-md border-2 border-muted bg-popover p-2 hover:cursor-pointer hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-blue-600"
		>
			<RadioGroup.Item
				value="departure"
				id="{idPrefix}-departure"
				class="sr-only"
				aria-label={t.departure}
			/>
			{t.departure}
		</Label>
		<Label
			for="{idPrefix}-arrival"
			class="flex grow justify-center rounded-md border-2 border-muted bg-popover p-2 hover:cursor-pointer hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-blue-600"
		>
			<RadioGroup.Item
				value="arrival"
				id="{idPrefix}-arrival"
				class="sr-only"
				aria-label={t.arrival}
			/>
			{t.arrival}
		</Label>
	</RadioGroup.Root>

	<DateInput bind:value={time} />
{/snippet}

{#snippet timePreview()}
	<div class="flex items-center gap-2 text-sm">
		<Clock class="size-4 shrink-0" />
		{t.atDateTime(timeType, time, time.toLocaleDateString() == new Date().toLocaleDateString())}
	</div>
{/snippet}

{#snippet repetitionPreview()}
	<div class="flex flex-col gap-3">
		<div class={cn('text-sm', selectedDayMask === 0 ? 'text-warning' : 'text-muted-foreground')}>
			{repetitionSummary}
		</div>
		<div class="flex flex-wrap gap-2">
			{#each t.ride.daysList as day, index}
				<span
					class={cn(
						'flex h-9 w-9 items-center justify-center rounded-full border text-sm font-medium',
						selectedDays[index]
							? 'border-blue-600 bg-blue-600 text-white'
							: 'border-muted bg-muted/60 text-muted-foreground'
					)}
				>
					{day.short}
				</span>
			{/each}
		</div>
	</div>
{/snippet}

<div class="md:min-h-[70dvh] md:w-96">
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
			rideSharingBounds={data.rideSharingBounds}
		/>
	{/if}

	<div class="contents" class:hidden={page.state.selectFrom || page.state.selectTo}>
		<form
			method="post"
			autocomplete="off"
			class="flex flex-col gap-4"
			use:enhance={() => {
				return async ({ update }) => {
					update({ reset: false });
				};
			}}
		>
			<h3 class="text-xl font-medium">{t.ride.create}</h3>
			<p class="">{t.ride.intro}</p>

			<div class="flex gap-2">
				<Popover.Root>
					<Popover.Trigger
						class={cn(buttonVariants({ variant: 'default' }), 'grow')}
						aria-label={t.ride.vehicle}
					>
						<span class="flex items-center">
							<Car class="mr-2" />
							{data.vehicles.find((v) => v.id.toString() == vehicle)?.licensePlate}
						</span>
					</Popover.Trigger>
					<Popover.Content class="flex w-fit flex-col gap-4">
						<RadioGroup.Root class="flex-rows justify-stretch" bind:value={vehicle}>
							{#each data.vehicles as v}
								<Label
									for={v.id.toString()}
									class="flex grow items-center justify-center rounded-md border-2 border-muted bg-popover p-2 hover:cursor-pointer hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-blue-600"
								>
									<RadioGroup.Item
										value={v.id.toString()}
										id={v.id.toString()}
										class="sr-only"
										aria-label={v.licensePlate ?? t.rideShare.defaultLicensePlate}
									/>
									<Car class="mr-2 h-5 w-5" />
									{v.licensePlate ?? t.rideShare.defaultLicensePlate}
								</Label>
							{/each}
						</RadioGroup.Root>

						<hr />
						<Button
							variant="outline"
							onclick={() => {
								storeLastPageAndGoto(`/account/add-or-edit-ride-share-vehicle/${vehicle}`);
							}}
						>
							{t.buttons.editVehicle}
						</Button>

						<Button
							variant="outline"
							onclick={() => {
								storeLastPageAndGoto('/account/add-or-edit-ride-share-vehicle');
							}}
						>
							<Plus class="mr-2 size-4" />
							{t.buttons.addVehicle}
						</Button>
					</Popover.Content>
				</Popover.Root>
				<Popover.Root>
					<Popover.Trigger class={cn(buttonVariants({ variant: 'default' }), 'grow')}>
						<span class="flex items-center">
							<Users class="mr-2" />
							{passengers}
						</span>
					</Popover.Trigger>
					<Popover.Content class="w-fit">
						<PlusMinus
							bind:value={passengers}
							min={1}
							max={data.vehicles.find((v) => v.id.toString() == vehicle)?.passengers ?? 3}
							step={1}
						/>
					</Popover.Content>
				</Popover.Root>
				<Popover.Root>
					<Popover.Trigger class={cn(buttonVariants({ variant: 'default' }), 'grow')}>
						<span class="flex items-center">
							<Luggage class="mr-2" />
							{luggage}
						</span>
					</Popover.Trigger>
					<Popover.Content class="w-fit">
						<PlusMinus
							bind:value={luggage}
							min={0}
							max={data.vehicles.find((v) => v.id.toString() == vehicle)?.luggage ?? 3}
							step={1}
						/>
					</Popover.Content>
				</Popover.Root>
			</div>

			<div class="w-full justify-self-center">
				<Button
					variant="outline"
					onclick={() =>
						pushState('', { showMap: true, selectedItinerary: page.state.selectedItinerary })}
					class="flex w-full justify-center"
				>
					<MapIcon class="h-[1.2rem] w-[1.2rem]" />
					{t.ride.showMap}
				</Button>
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
					class="absolute right-10 top-6 z-10"
					variant="outline"
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
					<ArrowUpDown class="h-5 w-5" />
				</Button>
			</div>
			<Card.Root
				class={offerCardClass(offerMode === 'single')}
				role="radio"
				aria-checked={offerMode === 'single'}
				tabindex={0}
				onclick={() => activateOfferMode('single')}
				onkeydown={(event) => handleOfferModeKeydown(event, 'single')}
			>
				<Card.Header>
					<Card.Title class="flex items-center gap-2 text-base">
						<Clock class="size-4" />
						{t.ride.singleRideOffer}
					</Card.Title>
				</Card.Header>
				<Card.Content class="flex flex-col gap-4 p-4">
					{#if offerMode === 'single'}
						<div
							class="flex flex-col gap-4"
							role="presentation"
							onclick={(event) => event.stopPropagation()}
							onkeydown={(event) => event.stopPropagation()}
						>
							{@render timeControls('single')}
						</div>
					{:else}
						{@render timePreview()}
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root
				class={offerCardClass(offerMode === 'repeating')}
				role="radio"
				aria-checked={offerMode === 'repeating'}
				tabindex={0}
				onclick={() => activateOfferMode('repeating')}
				onkeydown={(event) => handleOfferModeKeydown(event, 'repeating')}
			>
				<Card.Header>
					<Card.Title class="flex items-center gap-2 text-base">
						<CalendarDays class="size-4" />
						{t.ride.repetitionLabel}
					</Card.Title>
				</Card.Header>
				<Card.Content class="flex flex-col gap-4 p-4">
					{#if offerMode === 'repeating'}
						<div
							class="flex flex-col gap-4"
							role="presentation"
							onclick={(event) => event.stopPropagation()}
							onkeydown={(event) => event.stopPropagation()}
						>
							{@render timeControls('repeating')}
							<RepetitionSelector
								minValue={toCalendarDate(fromDate(new Date(Date.now() + HOUR * 2), TZ))}
								bind:range
								bind:selectedDays
								active={true}
								framed={false}
							></RepetitionSelector>
						</div>
					{:else}
						{@render timePreview()}
						{@render repetitionPreview()}
					{/if}
				</Card.Content>
			</Card.Root>

			<div class="flex items-center justify-center">
				{#if page.state.selectedItinerary && !loading}
					<Button
						variant="outline"
						onclick={() =>
							pushState('', { showMap: true, selectedItinerary: page.state.selectedItinerary })}
						class="size-fit text-base"
					>
						<div class="flex-row">
							<div class="flex items-center">
								<MapPin class="mr-2 h-5 w-5" />
								<Time
									variant="schedule"
									class="mr-4 w-auto font-semibold "
									queriedTime={time.toISOString()}
									isRealtime={false}
									scheduledTimestamp={page.state.selectedItinerary?.startTime}
									timestamp={page.state.selectedItinerary?.startTime}
								/>
								{t.departure}
							</div>
							<div class="flex items-center text-muted-foreground">
								<EllipsisVertical class="mr-2 h-5 w-5" />
								{formatDurationSec(page.state.selectedItinerary?.duration)}
							</div>
							<div class="flex items-center">
								<MapPinCheckInside class="mr-2 h-5 w-5" />
								<Time
									variant="schedule"
									class="mr-4 w-auto font-semibold"
									queriedTime={time.toISOString()}
									isRealtime={false}
									scheduledTimestamp={page.state.selectedItinerary?.endTime}
									timestamp={page.state.selectedItinerary?.endTime}
								/>
								{t.arrival}
							</div>
						</div>
					</Button>
				{:else if loading}
					<LoaderCircle class="h-6 w-6 animate-spin" />
				{/if}
			</div>
			<Message class="mb-6" msg={form?.msg || msg} />

			<p>{t.ride.outro}</p>
			<Button
				type="submit"
				class="w-full"
				disabled={!page.state.selectedItinerary ||
					loading ||
					(offerMode === 'repeating' && selectedDayMask === 0)}
			>
				{offerMode === 'single' ? t.ride.publishSingleRideOffer : t.ride.publishRepeatingRideOffers}
				<ChevronRightIcon />
			</Button>
			<input type="hidden" name="startLat" value={from.value.match?.lat} />
			<input type="hidden" name="startLon" value={from.value.match?.lon} />
			<input type="hidden" name="startLabel" value={from.label} />
			<input type="hidden" name="endLat" value={to.value.match?.lat} />
			<input type="hidden" name="endLon" value={to.value.match?.lon} />
			<input type="hidden" name="endLabel" value={to.label} />
			<input type="hidden" name="time" value={time.getTime()} />
			<input type="hidden" name="timeType" value={timeType} />
			<input type="hidden" name="vehicle" value={vehicle} />
			<input type="hidden" name="luggage" value={luggage} />
			<input type="hidden" name="passengers" value={passengers} />
			<input type="hidden" name="days" value={bitDays} />
			<input type="hidden" name="rangeStart" value={range.start.toString()} />
			<input type="hidden" name="rangeEnd" value={range.end.toString()} />
		</form>
	</div>
</div>
