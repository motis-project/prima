<script lang="ts">
	import LoaderCircle from 'lucide-svelte/icons/loader-circle';
	import maplibregl from 'maplibre-gl';
	import { getStyle } from '$lib/style';
	import Map from '$lib/Map.svelte';
	import Control from '$lib/Control.svelte';
	import { Location } from '$lib/location';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Select,
		SelectTrigger,
		SelectValue,
		SelectContent,
		SelectItem
	} from '$lib/components/ui/select';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Card } from '$lib/components/ui/card';
	import DateInput from '$lib/DateInput.svelte';
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import { Coordinates } from '$lib/location';
	import { booking } from '$lib/api';
	import { toTable } from '$lib/toTable';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { CircleAlert, CircleCheckBig } from "lucide-svelte/icons";
	import { Description } from 'formsnap';

	let zoom = $state(12);
	let bounds = $state<undefined | maplibregl.LngLatBounds>(undefined);
	let map = $state<null | maplibregl.Map>(null);

	let profile = $state({ value: 'foot', label: 'Foot' });
	let start = $state<Coordinates>({
		lat: 49.872584079,
		lng: 8.6312708899
	});
	let destination = $state<Coordinates>({
		lat: 50.11352164499803,
		lng: 8.677728968355844
	});
	let dummyAddress = {
		street: '',
    	house_number: '',
    	postal_code: '',
    	city: '',
	}
	let query = $derived<{
		from: Location,
		to: Location,
		// startFixed true --> Abfahrtszeit
 		startFixed: boolean,
		timeStamp: Date,
		numPassengers: number,
		numWheelchairs: number,
		numBikes: number,
		luggage: number
	}>({
		from: new Location(start, dummyAddress),
		to: new Location(destination, dummyAddress),
		startFixed: true,
		timeStamp: new Date(),
		numPassengers: 3,
		numWheelchairs: 0,
		numBikes: 0,
		luggage: 0
	});

	let init = false;
	let startMarker: any = null;
	let destinationMarker: any = null;

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
					const x = startMarker.getLngLat();
					start.lng = x.lng;
					start.lat = x.lat;
				});

			destinationMarker = new maplibregl.Marker({
				draggable: true,
				color: 'red'
			})
				.setLngLat([destination.lng, destination.lat])
				.addTo(map)
				.on('dragend', async () => {
					const x = destinationMarker.getLngLat();
					destination.lng = x.lng;
					destination.lat = x.lat;
				});

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
					startMarker.setLngLat(x);
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
					destinationMarker.setLngLat(x);
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
	let dateTime = $state(new Date());
	let arriveBy = $derived(timeType === 'arrival');

	let bookingResponse = $state<Array<Promise<any>>>([]);

	$effect(() => {
		bookingResponse = [booking(
			query.from, query.to, arriveBy, dateTime, query.numPassengers, query.numWheelchairs,
			query.numWheelchairs, query.luggage
		)];
	});

	// client ID: a9b1f1ad1051790a9c6970db85710986
	// client Secret: df987129855de70a804f146718aac956
	// client Secret: 30dee8771d325304274b7c2555fae33e
</script>

<Map
	bind:map
	bind:bounds
	transformRequest={(url, _resourceType) => {
		if (url.startsWith('/')) {
			return { url: `https://europe.motis-project.de/tiles${url}` };
		}
	}}
	center={[14.9361567, 51.150878]}
	zoom={zoom}
	style={getStyle(0)}
	className="h-screen w-screen h-full w-full rounded-lg border shadow"
>
	<Control position="bottom-left">
		<Card class="w-[520px] max-h-[90vh] overflow-y-auto overflow-x-hidden bg-white rounded-lg">
			<div class="flex flex-col w-full">
				<div class="flex flex-row space-x-4 p-4 shadow-md rounded">
					<!-- <ComboBox placeholder="From" /> -->
					<!-- <ComboBox placeholder="To" /> -->
					<DateInput bind:value={dateTime} />
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
						<Select bind:selected={profile}>
							<SelectTrigger>
								<SelectValue placeholder="Profile" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="wheelchair">Wheelchair</SelectItem>
								<SelectItem value="foot">Foot</SelectItem>
								<SelectItem value="bike">Bike</SelectItem>
								<SelectItem value="car">Car</SelectItem>
							</SelectContent>
						</Select>
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
									<Alert.Root variant={r.ok ? "default" : "destructive"}>
										{#if r.ok}
											<CircleCheckBig class="h-4 w-4" />
										{:else} 
											<CircleAlert class="h-4 w-4" />
										{/if}
										<Alert.Title class="font-bold text-base">{r.status}: {r.statusText}</Alert.Title>
										<Alert.Description>
											{res.status}: {res.message}
										</Alert.Description>
									</Alert.Root>
								</div>
							{/await}
						{:catch e}
							<div>Error: {e}</div>
						{/await}
					{/each}
				</div>
			</div>
		</Card>
	</Control>
</Map>