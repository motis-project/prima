<script lang="ts">
	import maplibregl from 'maplibre-gl';
	import { Card } from '$lib/shadcn/card';
	import Button from '$lib/shadcn/button/button.svelte';
	import Control from '$lib/map/Control.svelte';
	import { getStyle } from '$lib/map/style.js';
	import Map from '$lib/map/Map.svelte';
	import GeoJSON from '$lib/map/GeoJSON.svelte';
	import Message from '$lib/ui/Message.svelte';
	import { enhance } from '$app/forms';
	import Layer from '$lib/map/Layer.svelte';

	const { data, form } = $props();

	let map = $state<maplibregl.Map>();

	let start = $state({ lat: 51.5269344, lng: 14.5771254 });
	let destination = $state({ lat: 51.50573, lng: 14.638267 });

	let init = false;
	let startMarker: maplibregl.Marker | null = null;
	let destinationMarker: maplibregl.Marker | null = null;

	$effect(() => {
		if (map && !init) {
			startMarker = new maplibregl.Marker({ draggable: true, color: 'green' });
			startMarker
				.setLngLat([start.lng, start.lat])
				.addTo(map)
				.on('dragend', async () => {
					const x = startMarker!.getLngLat();
					start.lng = x.lng;
					start.lat = x.lat;
				});

			destinationMarker = new maplibregl.Marker({ draggable: true, color: 'red' });
			destinationMarker
				.setLngLat([destination.lng, destination.lat])
				.addTo(map)
				.on('dragend', async () => {
					const x = destinationMarker!.getLngLat();
					destination.lng = x.lng;
					destination.lat = x.lat;
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
</script>

<Map
	bind:map
	transformRequest={(url, _resourceType) => {
		if (url.startsWith('/')) {
			return { url: `http://localhost:8080/tiles${url}` };
		}
	}}
	center={[14.5771254, 51.5269344]}
	zoom={10}
	style={getStyle('light', 0)}
	class="h-full w-full rounded-lg border shadow"
	attribution={"&copy; <a href='http://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a>"}
>
	<Control position="bottom-left">
		<Card>
			<div class="flex w-full flex-col">
				{#if form?.msg}
					<Message msg={{ text: form?.msg, type: 'error' }} />
				{/if}
				<div class="flex flex-row space-x-4 rounded p-4 shadow-md">
					<form method="post" use:enhance>
						<input type="hidden" value={start.lat} name="fromLat" />
						<input type="hidden" value={start.lng} name="fromLng" />
						<input type="hidden" value={destination.lat} name="toLat" />
						<input type="hidden" value={destination.lng} name="toLng" />
						<input type="text" value={new Date().toISOString()} name="time" />
						<Button type="submit">Suchen</Button>
					</form>
				</div>
				{#if form?.vehicle}
					<div>Vehicle: {form.vehicle}</div>
				{/if}
			</div>
		</Card>
	</Control>

	<GeoJSON id="route" data={data.areas as GeoJSON.GeoJSON}>
		<Layer
			id="areas"
			type="fill"
			layout={{}}
			filter={['literal', true]}
			paint={{
				'fill-color': '#088',
				'fill-opacity': 0.4,
				'fill-outline-color': '#000'
			}}
		/>
		<Layer
			id="areas-outline"
			type="line"
			layout={{}}
			filter={['literal', true]}
			paint={{
				'line-color': '#000',
				'line-width': 2
			}}
		/>
		<Layer
			id="areas-labels"
			type="symbol"
			layout={{
				'symbol-placement': 'point',
				'text-field': ['get', 'name'],
				'text-font': ['Noto Sans Display Regular'],
				'text-size': 16
			}}
			filter={['literal', true]}
			paint={{
				'text-halo-width': 12,
				'text-halo-color': '#fff',
				'text-color': '#f00'
			}}
		/>
	</GeoJSON>
</Map>
