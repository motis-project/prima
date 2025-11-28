<script lang="ts">
	import { type Location } from '$lib/ui/AddressTypeahead.svelte';
	import { Button } from '$lib/shadcn/button';
	import { LocateFixed, ChevronLeft } from 'lucide-svelte';
	import { posToLocation } from '$lib/map/Location';
	import Map from '$lib/map/Map.svelte';
	import Popup from '$lib/map/Popup.svelte';
	import Marker from '$lib/map/Marker.svelte';
	import { env } from '$env/dynamic/public';
	import { getStyle } from '$lib/map/style';
	import Control from '$lib/map/Control.svelte';
	import maplibregl from 'maplibre-gl';
	import ItineraryGeoJson from './ItineraryGeoJSON.svelte';
	import GeoJSON from '$lib/map/GeoJSON.svelte';
	import Layer from '$lib/map/Layer.svelte';
	import { t } from '$lib/i18n/translation';
	import type { SignedItinerary } from '$lib/planAndSign';
	import { getColor } from '$lib/ui/modeStyle';

	let {
		from = $bindable(),
		to = $bindable(),
		itinerary,
		areas = $bindable(),
		rideSharingBounds = $bindable(),
		intermediateStops = $bindable()
	}: {
		from?: Location | undefined;
		to?: Location | undefined;
		itinerary?: SignedItinerary | undefined;
		areas?: unknown;
		rideSharingBounds?: unknown;
		intermediateStops?: boolean;
	} = $props();

	let fromMarker = $state<maplibregl.Marker>();
	let toMarker = $state<maplibregl.Marker>();
	let level = $state(0);

	let map = $state<maplibregl.Map>();
	let center = $state<maplibregl.LngLatLike>([14.633009555628965, 51.50654064579467]);

	const geolocate = new maplibregl.GeolocateControl({
		positionOptions: {
			enableHighAccuracy: true
		},
		showAccuracyCircle: false
	});

	const init = (map: maplibregl.Map) => {
		map.addControl(geolocate);
		if (from?.label || to?.label || itinerary) {
			console.log(from, to, itinerary);
			const box = new maplibregl.LngLatBounds(from?.value?.match, from?.value?.match);
			if (to?.value?.match) {
				box.extend(to?.value?.match);
			}
			if (itinerary) {
				itinerary.legs.forEach((l) => {
					box.extend(l.from);
					box.extend(l.to);
				});
			}
			const padding = {
				top: 64,
				right: 64,
				bottom: 64,
				left: 64
			};
			map.flyTo({ ...map.cameraForBounds(box, { padding, maxZoom: 14 }) });
		}
	};

	const showUserLocationOnMap = () => {
		geolocate.trigger();
	};
</script>

{#snippet contextMenu(e: maplibregl.MapMouseEvent, close: () => void)}
	<Button
		variant="default"
		onclick={() => {
			from = posToLocation(e.lngLat, level);
			fromMarker?.setLngLat(from.value.match!);
			close();
		}}
	>
		From
	</Button>
	<Button
		variant="default"
		onclick={() => {
			to = posToLocation(e.lngLat, level);
			toMarker?.setLngLat(to.value.match!);
			close();
		}}
	>
		To
	</Button>
{/snippet}

<div class="absolute bottom-16 left-0 right-0 top-0 z-20">
	<Map
		bind:map
		transformRequest={(url: string) => {
			if (url.startsWith('/')) {
				return { url: `${env.PUBLIC_MOTIS_URL}/tiles${url}` };
			}
		}}
		{center}
		zoom={9}
		style={getStyle('light', 0)}
		class="h-full w-full"
		attribution={"&copy; <a href='http://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a>"}
		onLoad={init}
	>
		<Control position="top-left">
			<Button variant="outline" size="icon" onclick={() => window.history.back()}>
				<ChevronLeft />
			</Button>
		</Control>
		<Control position="top-right">
			<Button variant="outline" size="icon" onclick={() => showUserLocationOnMap()}>
				<LocateFixed />
			</Button>
		</Control>
		<GeoJSON id="serviceareas" data={areas as GeoJSON.GeoJSON}>
			<Layer
				id="areas"
				type="fill"
				layout={{}}
				filter={['literal', true]}
				paint={{
					'fill-color': getColor({ mode: 'ODM' })[0],
					'fill-opacity': 0.15,
					'fill-outline-color': '#000'
				}}
			/>
			<Layer
				id="areas-outline"
				type="line"
				layout={{}}
				filter={['literal', true]}
				paint={{
					'line-color': getColor({ mode: 'ODM' })[0],
					'line-width': 2
				}}
			/>
			<Layer
				id="areas-labels"
				type="symbol"
				layout={{
					'symbol-placement': 'point',
					'text-field': ['concat', t.taxi + ' ' + t.serviceArea + ' ', ['get', 'name']],
					'text-font': ['Noto Sans Display Regular'],
					'text-size': 16
				}}
				filter={['literal', true]}
				paint={{
					'text-color': '#000'
				}}
			/>
		</GeoJSON>

		<GeoJSON id="rideSharingBounds" data={rideSharingBounds as GeoJSON.GeoJSON}>
			<Layer
				id="ride-sharing-areas"
				type="fill"
				layout={{}}
				filter={['literal', true]}
				paint={{
					'fill-color': getColor({ mode: 'RIDE_SHARING' })[0],
					'fill-opacity': 0.15,
					'fill-outline-color': '#000'
				}}
			/>
			<Layer
				id="ride-sharing-areas-outline"
				type="line"
				layout={{}}
				filter={['literal', true]}
				paint={{
					'line-color': getColor({ mode: 'RIDE_SHARING' })[0],
					'line-width': 2
				}}
			/>
			<Layer
				id="ride-sharing-areas-labels"
				type="symbol"
				layout={{
					'symbol-placement': 'line',
					'text-field': ['concat', t.rideSharing + ' ', ['get', 'name']],
					'text-font': ['Noto Sans Display Regular'],
					'text-size': 16
				}}
				filter={['literal', true]}
				paint={{
					'text-color': '#000'
				}}
			/>
		</GeoJSON>

		{#if !itinerary}
			<Popup trigger="click" children={contextMenu} />
		{/if}

		{#if itinerary}
			<ItineraryGeoJson {itinerary} {level} />
		{/if}

		{#if intermediateStops && itinerary}
			{#each itinerary.legs.flatMap((l) => l.intermediateStops || []) as e}
				<Marker
					color="black"
					draggable={false}
					{level}
					location={posToLocation(e, 0)}
					popup={e.name}
				/>
			{/each}
		{/if}

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
	</Map>
</div>
