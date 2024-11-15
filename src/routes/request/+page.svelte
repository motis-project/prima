<script lang="ts">
	import LoaderCircle from 'lucide-svelte/icons/loader-circle';
	import maplibregl from 'maplibre-gl';
	import { getStyle } from '$lib/style';
	import Map from '$lib/Map.svelte';
	import Control from '$lib/Control.svelte';
	import { Location } from '$lib/location';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Card } from '$lib/components/ui/card';
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import { Coordinates } from '$lib/location';
	import { booking } from '$lib/api';
	import { toTable } from '$lib/toTable';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { CircleAlert, CircleCheckBig } from 'lucide-svelte/icons';
	import Button from '$lib/components/ui/button/button.svelte';
	import GeoJSON from '$lib/GeoJSON.svelte';
	import Layer from '$lib/Layer.svelte';
	import { plan, reverseGeocode } from '$lib/motis/services.gen.js';
	import { coordinatesToPlace } from '$lib/motisUtils.js';
	import { MOTIS_BASE_URL } from '$lib/constants.js';
	const { data } = $props();

	let zoom = $state(10);
	let bounds = $state<undefined | maplibregl.LngLatBounds>(undefined);
	let map = $state<undefined | maplibregl.Map>();

	let start = $state<Coordinates>({
		lat: 51.526934461032994,
		lng: 14.57712544716437
	});
	let destination = $state<Coordinates>({
		lat: 51.505730979747334,
		lng: 14.638267982988827
	});
	type Address = {
		street: string;
		house_number: string;
		postal_code: string;
		city: string;
	};
	let emptyAddress = {
		street: '-',
		house_number: '-',
		postal_code: '-',
		city: '-'
	};

	const getAddress = async (coordinates: Coordinates): Promise<Address> => {
		const res = await reverseGeocode({
			baseUrl: MOTIS_BASE_URL,
			query: {
				place: coordinatesToPlace(coordinates)
			}
		});
		let addr = null;
		try {
			addr = res.data![1];
		} catch (e) {
			console.log(e);
		}

		if (addr != null) {
			return {
				street: addr.street ? addr.street : '-',
				house_number: addr.houseNumber ? addr.houseNumber : '-',
				postal_code: addr.zip ? addr.zip : '-',
				city: addr.name ? addr.name : '-'
			};
		} else {
			return emptyAddress;
		}
	};

	let query = $derived<{
		from: Location;
		to: Location;
		// startFixed true --> Abfahrtszeit
		startFixed: boolean;
		timeStamp: Date;
		numPassengers: number;
		numWheelchairs: number;
		numBikes: number;
		luggage: number;
	}>({
		from: new Location(start, emptyAddress),
		to: new Location(destination, emptyAddress),
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
			[
				'graph-node',
				'graph-edge',
				'graph-geometry',
				'matches',
				'match',
				'elevators',
				'elevators-match',
				'platform-way',
				'platform-node'
			].forEach((layer) => {
				map!.on('click', layer, async (e) => {
					const props = e.features![0].properties;
					new maplibregl.Popup().setLngLat(e.lngLat).setDOMContent(toTable(props)).addTo(map!);
					e.originalEvent.stopPropagation();
				});

				map!.on('mouseenter', layer, () => {
					map!.getCanvas().style.cursor = 'pointer';
				});

				map!.on('mouseleave', layer, () => {
					map!.getCanvas().style.cursor = '';
				});
			});

			startMarker = new maplibregl.Marker({
				draggable: true,
				color: 'green'
			})
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
			})
				.setLngLat([destination.lng, destination.lat])
				.addTo(map)
				.on('dragend', async () => {
					console.log('Dest dragged');
					const x = destinationMarker!.getLngLat();
					destination.lng = x.lng;
					destination.lat = x.lat;
					routes = [];
				});

			for (let e in data.companies) {
				new maplibregl.Marker({
					draggable: false,
					color: 'yellow'
				})
					.setLngLat([data.companies[e].longitude!, data.companies[e].latitude!])
					.addTo(map);
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

	let bookingResponse = $state<Array<Promise<Response>>>([]);

	// client ID: a9b1f1ad1051790a9c6970db85710986
	// client Secret: df987129855de70a804f146718aac956
	// client Secret: 30dee8771d325304274b7c2555fae33e

	type ColoredRoute = {
		/* eslint-disable-next-line */
		route: Promise<any>;
		color: string;
	};
	let routes = $state<Array<ColoredRoute>>([]);

	const getRoutes = (companyLat: number, companyLng: number) => {
		routes = [];
		routes.push({
			route: plan({
				baseUrl: MOTIS_BASE_URL,
				query: {
					fromPlace: coordinatesToPlace(new Coordinates(companyLat, companyLng)),
					toPlace: coordinatesToPlace(new Coordinates(start.lat, start.lng)),
					mode: ['CAR']
				}
			}),
			color: 'red'
		});
		routes.push({
			route: plan({
				baseUrl: MOTIS_BASE_URL,
				query: {
					fromPlace: coordinatesToPlace(new Coordinates(start.lat, start.lng)),
					toPlace: coordinatesToPlace(new Coordinates(destination.lat, destination.lng)),
					mode: ['CAR']
				}
			}),
			color: '#42a5f5'
		});
		routes.push({
			route: plan({
				baseUrl: MOTIS_BASE_URL,
				query: {
					fromPlace: coordinatesToPlace(new Coordinates(destination.lat, destination.lng)),
					toPlace: coordinatesToPlace(new Coordinates(companyLat, companyLng)),
					mode: ['CAR']
				}
			}),
			color: 'yellow'
		});
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
	style={getStyle(0)}
	className="h-screen w-screen h-full w-full rounded-lg border shadow"
>
	<Control position="bottom-left">
		<Card class="w-[520px] max-h-[90vh] overflow-y-auto overflow-x-hidden bg-white rounded-lg">
			<div class="flex flex-col w-full">
				<div class="flex flex-row space-x-4 p-4 shadow-md rounded">
					<input type="text" bind:value={dateTime} />
					<div class="flex">
						<RadioGroup.Root class="flex space-x-1 ml-1" bind:value={timeType}>
							<Label
								for="departure"
								class="flex items-center rounded-md border-2 border-muted bg-popover p-1 px-2 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-blue-600 hover:cursor-pointer"
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
								class="flex items-center rounded-md border-2 border-muted bg-popover p-1 px-2 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-blue-600 hover:cursor-pointer"
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
							on:click={async () => {
								let from = new Location(start, await getAddress(start));
								let to = new Location(destination, await getAddress(destination));

								bookingResponse = [
									booking(
										from,
										to,
										arriveBy,
										new Date(dateTime),
										query.numPassengers,
										query.numWheelchairs,
										query.numWheelchairs,
										query.luggage
									)
								];
							}}>Suchen</Button
						>
					</div>
				</div>
				<div class="flex flex-col space-y-8 h-[45vh] overflow-y-auto px-4 py-8">
					{#each bookingResponse as bookingResponse}
						{#await bookingResponse}
							<div class="flex items-center justify-center w-full">
								<LoaderCircle class="animate-spin w-12 h-12 m-20" />
							</div>
						{:then r}
							{#await r.json()}
								<div class="flex items-center justify-center w-full">
									<LoaderCircle class="animate-spin w-12 h-12 m-20" />
								</div>
							{:then res}
								<div class="w-full flex justify-between items-center space-x-4">
									<Alert.Root variant={r.ok ? 'default' : 'destructive'}>
										{#if r.ok}
											<CircleCheckBig class="h-4 w-4" />
										{:else}
											<CircleAlert class="h-4 w-4" />
										{/if}
										<Alert.Title class="font-bold text-base">{r.status}: {r.statusText}</Alert.Title
										>
										<Alert.Description>
											{res.status}: {res.message}
										</Alert.Description>
									</Alert.Root>
								</div>
								{#if r.ok}
									<Alert.Root variant={r.ok ? 'default' : 'destructive'}>
										<Alert.Description>
											{res.companyName}<br />
											{res.companyId}<br />
											{res.companyLat}<br />
											{res.companyLng}<br />
											{start.lat}<br />
											{getRoutes(res.companyLat, res.companyLng)}
										</Alert.Description>
									</Alert.Root>
								{/if}
							{/await}
						{:catch e}
							<div>Error: {e}</div>
						{/await}
					{/each}
				</div>
			</div>
		</Card>
	</Control>

	{#each routes as segment, i}
		{#await segment.route then r}
			{#if r.type == 'FeatureCollection'}
				<GeoJSON id={'r_ ' + i} data={r}>
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
			{/if}
		{/await}
	{/each}
</Map>
