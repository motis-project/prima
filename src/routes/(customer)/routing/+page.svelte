<script lang="ts">
	import X from 'lucide-svelte/icons/x';
	import MapIcon from 'lucide-svelte/icons/map';
	import { Card } from '$lib/shadcn/card';
	import { Button } from '$lib/shadcn/button';

	import { getStyle } from '$lib/map/style';
	import Map from '$lib/map/Map.svelte';
	import Control from '$lib/map/Control.svelte';
	import Marker from '$lib/map/Marker.svelte';
	import Popup from '$lib/map/Popup.svelte';
	import { type Location } from '$lib/ui/AddressTypeahead.svelte';
	import SearchMask from './SearchMask.svelte';
	import {
		initial,
		type Match,
		plan,
		type PlanResponse,
		trip,
		type Mode,
		type PlanData
	} from '$lib/openapi';
	import ItineraryList from './ItineraryList.svelte';
	import ConnectionDetail from './ConnectionDetail.svelte';
	import ItineraryGeoJson from './ItineraryGeoJSON.svelte';
	import maplibregl from 'maplibre-gl';
	import { browser } from '$app/environment';
	import { cn } from './utils';
	import Debug from './Debug.svelte';
	import LevelSelect from './LevelSelect.svelte';
	import { client } from '$lib/openapi';
	import StopTimes from './StopTimes.svelte';
	import { onMount, tick } from 'svelte';
	import { t } from '$lib/i18n/translation';
	import { pushState, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { posToLocation } from '$lib/map/Location';
	import { lngLatToStr } from '$lib/util/lngLatToStr';

	const urlParams = browser ? new URLSearchParams(window.location.search) : undefined;
	const hasDebug = urlParams && urlParams.has('debug');
	const hasDark = urlParams && urlParams.has('dark');
	const isSmallScreen = browser && window.innerWidth < 768;
	let showMap = $state(!isSmallScreen);

	let theme: 'light' | 'dark' =
		(hasDark ? 'dark' : undefined) ??
		(browser && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
			? 'dark'
			: 'light');
	if (theme === 'dark') {
		document.documentElement.classList.add('dark');
	}

	let center = $state.raw<[number, number]>([8.652235, 49.876908]);
	let level = $state(0);
	let zoom = $state(15);
	let bounds = $state<maplibregl.LngLatBoundsLike>();
	let map = $state<maplibregl.Map>();

	onMount(async () => {
		initial().then((d) => {
			const r = d.data;
			if (r) {
				center = [r.lon, r.lat];
				zoom = r.zoom;
			}
		});
		await tick();
		applyPageStateFromURL();
	});

	const applyPageStateFromURL = () => {
		if (browser && urlParams) {
			if (urlParams.has('tripId')) {
				onClickTrip(urlParams.get('tripId')!, true);
			}
			if (urlParams.has('stopId')) {
				const time = urlParams.has('time') ? new Date(urlParams.get('time')!) : new Date();
				onClickStop(
					'',
					urlParams.get('stopId')!,
					time,
					urlParams.get('stopArriveBy') == 'true',
					true
				);
			}
		}
	};

	let fromParam: Match | undefined = undefined;
	let toParam: Match | undefined = undefined;
	if (browser && urlParams && urlParams.has('from') && urlParams.has('to')) {
		fromParam = JSON.parse(urlParams.get('from') ?? '') ?? {};
		toParam = JSON.parse(urlParams.get('to') ?? '') ?? {};
	}

	let fromMatch = {
		match: fromParam
	};
	let toMatch = {
		match: toParam
	};

	let fromMarker = $state<maplibregl.Marker>();
	let toMarker = $state<maplibregl.Marker>();
	let from = $state<Location>({
		label: fromParam ? fromParam['name'] : '',
		value: fromParam ? fromMatch : {}
	});
	let to = $state<Location>({
		label: toParam ? toParam['name'] : '',
		value: toParam ? toMatch : {}
	});
	let time = $state<Date>(new Date());
	let timeType = $state<string>('departure');
	let wheelchair = $state(false);
	let bikeRental = $state(false);

	const toPlaceString = (l: Location) => {
		if (l.value.match?.type === 'STOP') {
			return l.value.match.id;
		} else if (l.value.match?.level) {
			return `${lngLatToStr(l.value.match!)},${l.value.match.level}`;
		} else {
			return `${lngLatToStr(l.value.match!)},0`;
		}
	};
	let modes = $derived(['WALK', ...(bikeRental ? ['RENTAL'] : [])] as Mode[]);
	let baseQuery = $derived(
		from.value.match && to.value.match
			? ({
					query: {
						time: time.toISOString(),
						fromPlace: toPlaceString(from),
						toPlace: toPlaceString(to),
						arriveBy: timeType === 'arrival',
						timetableView: true,
						pedestrianProfile: wheelchair ? 'WHEELCHAIR' : 'FOOT',
						preTransitModes: modes,
						postTransitModes: modes,
						directModes: modes
					}
				} as PlanData)
			: undefined
	);

	let searchDebounceTimer: ReturnType<typeof setTimeout> = setTimeout(() => {});
	let baseResponse = $state<Promise<PlanResponse>>();
	let routingResponses = $state<Array<Promise<PlanResponse>>>([]);
	let stopNameFromResponse = $state<string>('');
	$effect(() => {
		if (baseQuery) {
			clearTimeout(searchDebounceTimer);
			searchDebounceTimer = setTimeout(() => {
				const base = plan(baseQuery).then((response) => {
					if (response.error) throw new Error(String(response.error));
					return response.data!;
				});
				baseResponse = base;
				routingResponses = [base];
				replaceState('?', {});
			}, 400);
		}
	});

	if (browser) {
		addEventListener('paste', (event) => {
			const paste = event.clipboardData!.getData('text');
			const json = JSON.parse(paste);
			console.log('paste: ', json);
			const response = new Promise<PlanResponse>((resolve, _) => {
				resolve(json as PlanResponse);
			});
			baseResponse = response;
			routingResponses = [response];
		});
	}

	const flyToSelectedItinerary = () => {
		if (page.state.selectedItinerary && map) {
			const start = maplibregl.LngLat.convert(page.state.selectedItinerary.legs[0].from);
			const box = new maplibregl.LngLatBounds(start, start);
			page.state.selectedItinerary.legs.forEach((l) => {
				box.extend(l.from);
				box.extend(l.to);
				l.intermediateStops?.forEach((x) => {
					box.extend(x);
				});
			});
			const padding = {
				top: isSmallScreen ? Math.max(window.innerHeight / 2, 400) : 96,
				right: 96,
				bottom: 96,
				left: isSmallScreen ? 96 : 640
			};
			map.flyTo({ ...map.cameraForBounds(box), padding });
		}
	};

	$effect(() => {
		flyToSelectedItinerary();
	});

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

	const onClickStop = (
		name: string,
		stopId: string,
		time: Date,
		arriveBy: boolean = false,
		replace: boolean = false
	) => {
		pushStateWithQueryString(
			{ stopArriveBy: arriveBy, stopId, time: time.toISOString() },
			{
				stopArriveBy: arriveBy,
				selectedStop: { name, stopId, time },
				selectedItinerary: page.state.selectedItinerary,
				tripId: page.state.tripId
			},
			replace
		);
	};

	const onClickTrip = async (tripId: string, replace: boolean = false) => {
		const { data: itinerary, error } = await trip({ query: { tripId } });
		if (error) {
			console.log(error);
			alert(String((error as Record<string, unknown>).error ?? error));
			return;
		}
		pushStateWithQueryString({ tripId }, { selectedItinerary: itinerary, tripId: tripId }, replace);
	};

	type CloseFn = () => void;
</script>

{#snippet contextMenu(e: maplibregl.MapMouseEvent, close: CloseFn)}
	<Button
		variant="outline"
		onclick={() => {
			from = posToLocation(e.lngLat, level);
			fromMarker?.setLngLat(from.value.match!);
			close();
		}}
	>
		From
	</Button>
	<Button
		variant="outline"
		onclick={() => {
			to = posToLocation(e.lngLat, level);
			toMarker?.setLngLat(to.value.match!);
			close();
		}}
	>
		To
	</Button>
{/snippet}

<Map
	bind:map
	bind:bounds
	bind:zoom
	transformRequest={(url: string) => {
		if (url.startsWith('/sprite')) {
			return { url: `${window.location.origin}${url}` };
		}
		if (url.startsWith('/')) {
			return { url: `${client.getConfig().baseUrl}/tiles${url}` };
		}
	}}
	{center}
	class={cn('h-dvh w-full overflow-clip', theme)}
	style={showMap ? getStyle(theme, level) : undefined}
	attribution={"&copy; <a href='http://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a>"}
>
	{#if hasDebug}
		<Control position="top-right">
			<Debug {bounds} {level} />
		</Control>
	{/if}

	{#if !isSmallScreen || (!page.state.selectedItinerary && !page.state.selectedStop)}
		<Control position="top-left">
			<Card class="overflow-y-auto overflow-x-hidden rounded-lg bg-background">
				<SearchMask bind:from bind:to bind:time bind:timeType bind:wheelchair bind:bikeRental />
			</Card>
		</Control>
	{/if}

	<LevelSelect {bounds} {zoom} bind:level />

	{#if !page.state.selectedItinerary && routingResponses.length !== 0}
		<Control position="top-left" class="min-h-0 md:mb-2">
			<Card
				class="h-full overflow-y-auto overflow-x-hidden rounded-lg bg-background md:max-h-[70vh]"
			>
				<ItineraryList
					{baseResponse}
					{routingResponses}
					{baseQuery}
					selectItinerary={(selectedItinerary) => pushState('', { selectedItinerary })}
				/>
			</Card>
		</Control>
	{/if}

	{#if page.state.selectedItinerary && !page.state.selectedStop}
		<Control position="top-left" class="mb-12 min-h-0 md:mb-2">
			<Card class="flex h-full flex-col rounded-lg bg-background">
				<div class="mb-1 flex w-full items-center justify-between pl-1 shadow-md">
					<h2 class="ml-2 text-base font-semibold">{t.journeyDetails}</h2>
					<Button
						variant="ghost"
						onclick={() => {
							pushStateWithQueryString({}, {});
						}}
					>
						<X />
					</Button>
				</div>
				<div
					class={'min-h-0 overflow-y-auto overflow-x-hidden p-2 md:p-4 ' +
						(showMap ? 'max-h-[40vh] md:max-h-[70vh]' : '')}
				>
					<ConnectionDetail itinerary={page.state.selectedItinerary} {onClickStop} {onClickTrip} />
				</div>
			</Card>
		</Control>
		{#if showMap}
			<ItineraryGeoJson itinerary={page.state.selectedItinerary} {level} />
		{/if}
	{/if}

	{#if page.state.selectedStop}
		<Control position="top-left" class="min-h-0 md:mb-2">
			<Card class="flex h-full flex-col rounded-lg bg-background">
				<div class="mb-1 flex w-full items-center justify-between pl-1 shadow-md">
					<h2 class="ml-2 text-base font-semibold">
						{#if page.state.stopArriveBy}
							{t.arrivals}
						{:else}
							{t.departures}
						{/if}
						in
						{stopNameFromResponse}
					</h2>
					<Button
						variant="ghost"
						onclick={() => {
							pushStateWithQueryString(
								{ tripId: page.state.tripId },
								{ selectedItinerary: page.state.selectedItinerary }
							); // TODO
						}}
					>
						<X />
					</Button>
				</div>
				<div class="min-h-0 overflow-y-auto overflow-x-hidden p-2 md:max-h-[70vh] md:p-4">
					<StopTimes
						stopId={page.state.selectedStop.stopId}
						time={page.state.selectedStop.time}
						bind:stopNameFromResponse
						arriveBy={page.state.stopArriveBy}
						setArriveBy={(arriveBy) =>
							onClickStop(
								page.state.selectedStop!.name,
								page.state.selectedStop!.stopId,
								page.state.selectedStop!.time,
								arriveBy
							)}
						{onClickTrip}
					/>
				</div>
			</Card>
		</Control>
	{/if}

	{#if showMap}
		<Popup trigger="contextmenu" children={contextMenu} />

		{#if from}
			<Marker
				color="green"
				draggable={true}
				{level}
				bind:location={from}
				bind:marker={fromMarker}
			/>
		{/if}

		{#if to}
			<Marker color="red" draggable={true} {level} bind:location={to} bind:marker={toMarker} />
		{/if}
	{:else}
		<Control position="bottom-left" class="pb-4">
			<Button
				size="icon"
				variant="default"
				onclick={() => {
					showMap = true;
					flyToSelectedItinerary();
				}}
			>
				<MapIcon class="h-[1.2rem] w-[1.2rem]" />
			</Button>
		</Control>
	{/if}
</Map>
