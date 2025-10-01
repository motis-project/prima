<script lang="ts">
	import { Button } from '$lib/shadcn/button';
	import { pushState, replaceState } from '$app/navigation';
	import Message from '$lib/ui/Message.svelte';
	import { type Msg } from '$lib/msg';
	import { t } from '$lib/i18n/translation';
	import {
		ArrowUpDown,
		ChevronRightIcon,
		LoaderCircle,
		LocateFixed,
		MapIcon,
		Plus
	} from 'lucide-svelte';
	import PopupMap from '$lib/ui/PopupMap.svelte';
	import { page } from '$app/state';

	import { type Location } from '$lib/ui/AddressTypeahead.svelte';
	import AddressTypeahead from '$lib/ui/AddressTypeahead.svelte';

	import DateInput from '../../routing/DateInput.svelte';
	import * as RadioGroup from '$lib/shadcn/radio-group';

	import { type TimeType } from '$lib/util/TimeType';
	import { Label } from '$lib/shadcn/label';
	import * as Select from '$lib/shadcn/select';
	import { lngLatToStr } from '$lib/util/lngLatToStr';
	import { posToLocation } from '$lib/map/Location';
	import Time from '../../routing/Time.svelte';
	import { formatDurationSec } from '../../routing/formatDuration';
	import maplibregl from 'maplibre-gl';
	import type { Itinerary } from '$lib/openapi';
	import { enhance } from '$app/forms';

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

	let time = $state<Date>(new Date());
	let timeType = $state<TimeType>('departure');

	let vehicle = $state<string | undefined>(
		data.vehicles.length ? data.vehicles[0].id.toString() : undefined
	);

	const toPlaceString = (l: Location) => {
		if (l.value.match?.level) {
			return `${lngLatToStr(l.value.match!)},${l.value.match.level}`;
		} else {
			return `${lngLatToStr(l.value.match!)},0`;
		}
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

	type Timeout = ReturnType<typeof setTimeout>;
	let searchDebounceTimer: Timeout;
	let loading = $state(false);
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
					.catch((err) => {
						msg = { type: 'error', text: 'routingRequestFailed' };
						replaceState('', {});
						loading = false;
					});
			}, 400);
		}
	});
</script>

<div class="flex flex-col">
	{#if page.state.showMap}
		<PopupMap bind:from bind:to itinerary={page.state.selectedItinerary} />
	{:else}
		<form
			method="post"
			class="flex flex-col gap-6"
			use:enhance={() => {
				return async ({ update }) => {
					update({ reset: false });
				};
			}}
		>
			<h3 class="text-xl font-medium">{t.ride.create}</h3>
			<p>{t.ride.intro}</p>

			<Message class="mb-6" msg={form?.msg || msg} />

			<div class="flex flex-row gap-2">
				<Select.Root type="single" name="vehicle" bind:value={vehicle}>
					<Select.Trigger class="overflow-hidden" aria-label={t.ride.vehicle}>
						{data.vehicles.find((v) => v.id.toString() == vehicle)?.licensePlate}
					</Select.Trigger>
					<Select.Content>
						{#each data.vehicles as v}
							<Select.Item value={v.id.toString()} label={v.licensePlate}>
								{v.licensePlate}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>

				<Button variant="outline">
					<Plus class="mr-1 size-4" />
					{t.ride.addVehicle}
				</Button>
			</div>

			<div class="relative flex flex-col space-y-4 py-4">
				<AddressTypeahead
					name="from"
					placeholder={t.from}
					bind:selected={from}
					bind:items={fromItems}
					focus={false}
				/>
				<AddressTypeahead
					name="to"
					placeholder={t.to}
					bind:selected={to}
					bind:items={toItems}
					focus={false}
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
			<div class="flex flex-row flex-wrap gap-2">
				<DateInput bind:value={time} />
				<RadioGroup.Root class="flex" name="timeType" bind:value={timeType}>
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
						<RadioGroup.Item value="arrival" id="arrival" class="sr-only" aria-label={t.arrival} />
						<span>{t.arrival}</span>
					</Label>
				</RadioGroup.Root>
			</div>

			<div class="flex flex-row flex-wrap items-center gap-2">
				{#if page.state.selectedItinerary && !loading}
					{t.departure}
					<Time
						variant="schedule"
						class="w-16 font-semibold"
						queriedTime={time.toISOString()}
						isRealtime={false}
						scheduledTimestamp={page.state.selectedItinerary?.startTime}
						timestamp={page.state.selectedItinerary?.startTime}
					/>
					{t.arrival}
					<Time
						variant="schedule"
						class="w-16 font-semibold"
						queriedTime={time.toISOString()}
						isRealtime={false}
						scheduledTimestamp={page.state.selectedItinerary?.endTime}
						timestamp={page.state.selectedItinerary?.endTime}
					/>
					{t.duration}
					{formatDurationSec(page.state.selectedItinerary?.duration)}
				{:else if loading}
					<div class="flex items-center justify-center">
						<LoaderCircle class="h-6 w-6 animate-spin" />
					</div>
				{/if}
				<Button
					size="icon"
					variant="outline"
					onclick={() =>
						pushState('', { showMap: true, selectedItinerary: page.state.selectedItinerary })}
					class="ml-auto"
				>
					<MapIcon class="h-[1.2rem] w-[1.2rem]" />
				</Button>
			</div>

			<p>{t.ride.outro}</p>
			<Button type="submit" class="w-full" disabled={!page.state.selectedItinerary || loading}>
				{t.ride.publish}
				<ChevronRightIcon />
			</Button>
			<input type="hidden" name="startLat" value={from.value.match?.lat} />
			<input type="hidden" name="startLon" value={from.value.match?.lon} />
			<input type="hidden" name="startLabel" value={from.label} />
			<input type="hidden" name="endLat" value={to.value.match?.lat} />
			<input type="hidden" name="endLon" value={to.value.match?.lon} />
			<input type="hidden" name="endLabel" value={to.label} />
			<input type="hidden" name="time" value={time.getTime()} />
			<input
				type="hidden"
				name="luggage"
				value={data.vehicles.find((v) => v.id.toString() == vehicle)?.luggage}
			/>
			<input
				type="hidden"
				name="passengers"
				value={data.vehicles.find((v) => v.id.toString() == vehicle)?.passengers}
			/>
		</form>
	{/if}
</div>
