<script lang="ts">
	import Layer from '$lib/map/Layer.svelte';
	import GeoJSON from '$lib/map/GeoJSON.svelte';
	import type { Leg } from '$lib/openapi';

	let {
		legs = $bindable(),
		prefix = ''
	}: {
		legs: Leg[];
		prefix?: string;
	} = $props();
</script>

<GeoJSON
	id={prefix + '_markers'}
	data={{
		type: 'FeatureCollection',
		features: legs.flatMap((l) => [
			{
				type: 'Feature',
				geometry: {
					type: 'Point',
					coordinates: [l.from.lon, l.from.lat]
				},
				properties: { label: l.from.name, color: '#008000' }
			},
			{
				type: 'Feature',
				geometry: {
					type: 'Point',
					coordinates: [l.to.lon, l.to.lat]
				},
				properties: { label: l.to.name, color: '#ff0000' }
			}
		])
	}}
>
	<Layer
		id={prefix + '_marker'}
		type="circle"
		layout={{}}
		filter={['all']}
		paint={{ 'circle-radius': 10, 'circle-color': ['get', 'color'], 'circle-opacity': 0.5 }}
	/>
</GeoJSON>
