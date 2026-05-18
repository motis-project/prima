<script lang="ts">
	import Layer from '$lib/map/Layer.svelte';
	import GeoJSON from '$lib/map/GeoJSON.svelte';
	import type { Itinerary, Leg, Mode } from '$lib/openapi';
	import { getColor } from './modeStyle';
	import polyline from 'polyline';
	import { colord } from 'colord';

	const PRECISION = 7;

	function isIndividualTransport(m: Mode): boolean {
		return m == 'WALK' || m == 'BIKE' || m == 'CAR';
	}

	function getRidesharingCoordinates(l: Leg): number[][] {
		let c = new Array<Array<number>>();
		c.push([l.from.lon, l.from.lat]);
		if(l.intermediateStops !== undefined) {
			l.intermediateStops.forEach(s => {
				c.push([s.lon,s.lat]);
			});
		}
		c.push([l.to.lon, l.to.lat]);
		return c;
	}

	function itineraryToGeoJSON(i: Itinerary): GeoJSON.GeoJSON {
		return {
			type: 'FeatureCollection',
			features: i.legs.flatMap((l) => {
				const color = isIndividualTransport(l.mode) ? '#42a5f5' : `${getColor(l)[0]}`;
				const outlineColor = colord(color).darken(0.2).toHex();

				if (l.mode === 'RIDE_SHARING') {
					return [
						{
							type: 'Feature',
							properties: {
								color,
								outlineColor,
								level: 0,
								way: 0,
								dashed: 1
							},
							geometry: {
								type: 'LineString',
								coordinates: getRidesharingCoordinates(l)
							}
						}
					];
				}

				if (l.steps) {
					return l.steps.map((p) => {
						return {
							type: 'Feature',
							properties: {
								color,
								outlineColor,
								level: p.fromLevel,
								way: p.osmWay
							},
							geometry: {
								type: 'LineString',
								coordinates: polyline.decode(p.polyline.points, PRECISION).map(([x, y]) => [y, x])
							}
						};
					});
				} else {
					return {
						type: 'Feature',
						properties: {
							outlineColor,
							color
						},
						geometry: {
							type: 'LineString',
							coordinates: polyline.decode(l.legGeometry.points, PRECISION).map(([x, y]) => [y, x])
						}
					};
				}
			})
		};
	}

	const {
		itinerary,
		level
	}: {
		itinerary: Itinerary;
		level: number;
	} = $props();

	const geojson = $derived(itineraryToGeoJSON(itinerary));
</script>

<GeoJSON id="route" data={geojson}>
	<!-- solid -->
	<Layer
		id="path-outline"
		type="line"
		layout={{
			'line-join': 'round',
			'line-cap': 'round'
		}}
		filter={['all', ['any', ['!has', 'level'], ['==', 'level', level]], ['!has', 'dashed']]}
		paint={{
			'line-color': ['get', 'outlineColor'],
			'line-width': 10,
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
		filter={['all', ['any', ['!has', 'level'], ['==', 'level', level]], ['!has', 'dashed']]}
		paint={{
			'line-color': ['get', 'color'],
			'line-width': 7.5,
			'line-opacity': 0.8
		}}
	/>

	<!-- dashed -->
	<Layer
		id="path-outline-dashed-left"
		type="line"
		layout={{
			'line-join': 'round',
			'line-cap': 'round'
		}}
		filter={['all', ['any', ['!has', 'level'], ['==', 'level', level]], ['has', 'dashed']]}
		paint={{
			'line-dasharray': ['literal', [1, 2]],
			'line-color': ['get', 'outlineColor'],
			'line-width': 7.5,
			'line-opacity': 0.8,
			'line-offset': -1.25
		}}
	/>
	<Layer
		id="path-outline-dashed-right"
		type="line"
		layout={{
			'line-join': 'round',
			'line-cap': 'round'
		}}
		filter={['all', ['any', ['!has', 'level'], ['==', 'level', level]], ['has', 'dashed']]}
		paint={{
			'line-dasharray': ['literal', [1, 2]],
			'line-color': ['get', 'outlineColor'],
			'line-width': 7.5,
			'line-opacity': 0.8,
			'line-offset': 1.25
		}}
	/>
	<Layer
		id="path-dashed"
		type="line"
		layout={{
			'line-join': 'round',
			'line-cap': 'round'
		}}
		filter={['all', ['any', ['!has', 'level'], ['==', 'level', level]], ['has', 'dashed']]}
		paint={{
			'line-dasharray': ['literal', [1, 2]],
			'line-color': ['get', 'color'],
			'line-width': 7.5,
			'line-opacity': 0.8
		}}
	/>
</GeoJSON>
