<script lang="ts">
	import LoaderCircle from 'lucide-svelte/icons/loader-circle';
	import maplibregl from 'maplibre-gl';
	import { Label } from '$lib/shadcn/label/index.js';
	import { Card } from '$lib/shadcn/card';
	import * as RadioGroup from '$lib/shadcn/radio-group/index.js';
	import * as Alert from '$lib/shadcn/alert/index.js';
	import { CircleAlert, CircleCheckBig } from 'lucide-svelte/icons';
	import Button from '$lib/shadcn/button/button.svelte';
	import Control from '$lib/map/Control.svelte';
	import { getStyle } from '$lib/map/style.js';
	import { polylineToGeoJSON } from '$lib/util/polylineToGeoJSON.js';
	import Layer from '$lib/map/Layer.svelte';
	import GeoJSON from '$lib/map/GeoJSON.svelte';
	import Map from '$lib/map/Map.svelte';
	import { carRouting } from '$lib/util/carRouting.js';

	const { data } = $props();

	const booking = async (
		from: { coordinates: { lat: number; lng: number }; address: string },
		to: { coordinates: { lat: number; lng: number }; address: string },
		startFixed: boolean,
		timeStamp: Date,
		numPassengers: number,
		numWheelchairs: number,
		numBikes: number,
		luggage: number
	) => {
		return await fetch('/api/booking', {
			method: 'POST',
			body: JSON.stringify({
				from,
				to,
				startFixed,
				timeStamp,
				numPassengers,
				numWheelchairs,
				numBikes,
				luggage
			})
		});
	};

	let zoom = $state(10);
	let bounds = $state<maplibregl.LngLatBounds>();
	let map = $state<maplibregl.Map>();

	let start = $state({
		lat: 51.526934461032994,
		lng: 14.57712544716437
	});
	let destination = $state({
		lat: 51.505730979747334,
		lng: 14.638267982988827
	});
	let query = $derived({
		from: { coordinates: start, address: '' },
		to: { coordinates: destination, address: '' },
		startFixed: true,
		timeStamp: new Date(),
		numPassengers: 3,
		numWheelchairs: 0,
		numBikes: 0,
		luggage: 0
	});

	let init = false;
	let startMarker: maplibregl.Marker | null = null;
	let destinationMarker: maplibregl.Marker | null = null;

	$effect(() => {
		if (map && !init) {
			startMarker = new maplibregl.Marker({
				draggable: true,
				color: 'green'
			});
			startMarker
				.setLngLat([start.lng, start.lat])
				.addTo(map)
				.on('dragend', async () => {
					const x = startMarker!.getLngLat();
					start.lng = x.lng;
					start.lat = x.lat;
					routes = [];
				});

			destinationMarker = new maplibregl.Marker({
				draggable: true,
				color: 'red'
			});
			destinationMarker
				.setLngLat([destination.lng, destination.lat])
				.addTo(map)
				.on('dragend', async () => {
					const x = destinationMarker!.getLngLat();
					destination.lng = x.lng;
					destination.lat = x.lat;
					routes = [];
				});

			for (let e in data.companies) {
				const c = new maplibregl.Marker({ draggable: false, color: 'yellow' });
				c.setLngLat({
					lat: data.companies[e].lat!,
					lng: data.companies[e].lng!
				});
				c.addTo(map);
			}

			let popup: maplibregl.Popup | null = null;
			map.on('contextmenu', (e) => {
				if (popup != null) {
					popup.remove();
				}
				popup = new maplibregl.Popup({
					anchor: 'top-left'
				});
				const x = e.lngLat;

				const actionsDiv = document.createElement('div');
				const setStart = document.createElement('a');
				setStart.classList.add('m-2');
				setStart.href = '#';
				setStart.innerText = 'start';
				setStart.onclick = () => {
					startMarker!.setLngLat(x);
					start.lng = x.lng;
					start.lat = x.lat;
					popup!.remove();
				};
				actionsDiv.appendChild(setStart);

				const setDest = document.createElement('a');
				setDest.classList.add('m-2');
				setDest.href = '#';
				setDest.innerText = 'destination';
				setDest.onclick = () => {
					destinationMarker!.setLngLat(x);
					destination.lng = x.lng;
					destination.lat = x.lat;
					popup!.remove();
				};
				actionsDiv.appendChild(setDest);

				popup.setLngLat(x).setDOMContent(actionsDiv).addTo(map!);
			});

			init = true;
		}
	});

	let timeType = $state('departure');
	let dateTime = $state(new Date().toISOString());
	let arriveBy = $derived(timeType === 'arrival');

	let bookingResponse = $state<Promise<Response>>();

	type ColoredRoute = {
		/* eslint-disable-next-line */
		route: Promise<any>;
		color: string;
	};
	let routes = $state<Array<ColoredRoute>>([]);

	const getRoutes = (lat: number, lng: number) => {
		routes.push({
			route: carRouting({ lat, lng }, start),
			color: 'red'
		});
		routes.push({
			route: carRouting(start, destination),
			color: '#42a5f5'
		});
		routes.push({
			route: carRouting(destination, { lat, lng }),
			color: 'yellow'
		});
	};

	const getResponse = async () => {
		if (bookingResponse) {
			return await (await bookingResponse).json();
		} else {
			return '';
		}
	};
</script>

<Map
	bind:map
	bind:bounds
	transformRequest={(url, _resourceType) => {
		if (url.startsWith('/')) {
			return { url: `https://europe.motis-project.de/tiles${url}` };
		}
	}}
	center={[14.889815398274935, 51.33709604007766]}
	{zoom}
	style={getStyle('light', 0)}
	class="h-full w-full rounded-lg border shadow"
	attribution={"&copy; <a href='http://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a>"}
>
	<Control position="bottom-left">
		<Card class="max-h-[90vh] w-[520px] overflow-y-auto overflow-x-hidden rounded-lg bg-white">
			<div class="flex w-full flex-col">
				<div class="flex flex-row space-x-4 rounded p-4 shadow-md">
					<input type="text" bind:value={dateTime} />
					<div class="flex">
						<RadioGroup.Root class="ml-1 flex space-x-1" bind:value={timeType}>
							<Label
								for="departure"
								class="flex items-center rounded-md border-2 border-muted bg-popover p-1 px-2 hover:cursor-pointer hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-blue-600"
							>
								<RadioGroup.Item
									value="departure"
									id="departure"
									class="sr-only"
									aria-label="Abfahrt"
								/>
								<span>Abfahrt</span>
							</Label>
							<Label
								for="arrival"
								class="flex items-center rounded-md border-2 border-muted bg-popover p-1 px-2 hover:cursor-pointer hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-blue-600"
							>
								<RadioGroup.Item
									value="arrival"
									id="arrival"
									class="sr-only"
									aria-label="Ankunft"
								/>
								<span>Ankunft</span>
							</Label>
						</RadioGroup.Root>
					</div>
					<div class="min-w-24">
						<Button
							variant="outline"
							onclick={() => {
								bookingResponse = booking(
									query.from,
									query.to,
									arriveBy,
									new Date(dateTime),
									query.numPassengers,
									query.numWheelchairs,
									query.numWheelchairs,
									query.luggage
								);
							}}>Suchen</Button
						>
					</div>
				</div>
				<div class="flex h-[45vh] flex-col space-y-8 overflow-y-auto px-4 py-8">
					{#if bookingResponse !== undefined}
						{#await getResponse()}
							<div class="flex w-full items-center justify-center">
								JSON lädt...
								<LoaderCircle class="m-20 h-12 w-12 animate-spin" />
							</div>
						{:then res}
							<div class="flex w-full items-center justify-between space-x-4">
								<Alert.Root variant={res.status == 0 ? 'default' : 'destructive'}>
									{#if res.status == 0}
										<CircleCheckBig class="h-4 w-4" />
									{:else}
										<CircleAlert class="h-4 w-4" />
									{/if}
									<Alert.Title class="text-base font-bold">
										{res.status}: {res.statusText}
									</Alert.Title>
									<Alert.Description>
										{res.status}: {res.message}
									</Alert.Description>
								</Alert.Root>
							</div>
							{#if res.status == 0}
								{res.companyName}<br />
								{res.companyId}<br />
								{res.companyLat}<br />
								{res.companyLng}<br />
								{start.lat}<br />
								{getRoutes(res.companyLat, res.companyLng)}
							{/if}
						{/await}
					{/if}
				</div>
			</div>
		</Card>
	</Control>

	{#each routes as segment, i}
		{#await segment.route then r}
			{#if r.direct.length != 0 && r.direct[0] != undefined}
				{#each r.direct[0].legs as leg}
					<GeoJSON id={'r_ ' + i} data={polylineToGeoJSON(leg.legGeometry.points)}>
						<Layer
							id={'path-outline_ ' + i}
							type="line"
							layout={{
								'line-join': 'round',
								'line-cap': 'round'
							}}
							filter={true}
							paint={{
								'line-color': '#1966a4',
								'line-width': 7.5,
								'line-opacity': 0.8
							}}
						/>
						<Layer
							id={'path_ ' + i}
							type="line"
							layout={{
								'line-join': 'round',
								'line-cap': 'round'
							}}
							filter={true}
							paint={{
								'line-color': segment.color,
								'line-width': 5,
								'line-opacity': 0.8
							}}
						/>
					</GeoJSON>
				{/each}
			{/if}
		{/await}
	{/each}
</Map>
