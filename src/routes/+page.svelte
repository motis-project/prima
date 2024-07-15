<script lang="ts">
	import Map from '$lib/Map.svelte';
	import GeoJSON from '$lib/GeoJSON.svelte';
	import Layer from '$lib/Layer.svelte';
	import { getStyle } from '$lib/style.js';
	import { getRoute } from '$lib/api';

	let route = getRoute({
		start: {
			lat: 50.106847864,
			lng: 8.6632053122,
			level: 0
		},
		destination: {
			lat: 49.872584079,
			lng: 8.6312708899,
			level: 0
		},
		profile: 'car',
		direction: 'forward'
	});
</script>

<Map
	transformRequest={(url) => {
		if (url.startsWith('/')) {
			return { url: `https://europe.motis-project.de/tiles${url}` };
		}
	}}
	style={getStyle(0)}
	center={[8.563351200419433, 50]}
	zoom={10}
	className="h-screen w-screen"
>
	{#await route then r}
		{#if r.type == 'FeatureCollection'}
			<GeoJSON id="route" data={r}>
				<Layer
					id="path-outline"
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
					id="path"
					type="line"
					layout={{
						'line-join': 'round',
						'line-cap': 'round'
					}}
					filter={true}
					paint={{
						'line-color': '#42a5f5',
						'line-width': 5,
						'line-opacity': 0.8
					}}
				/>
			</GeoJSON>
		{/if}
	{/await}
</Map>
