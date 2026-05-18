<script lang="ts">
	import Layer from '$lib/map/Layer.svelte';
	import GeoJSON from '$lib/map/GeoJSON.svelte';
	import type { Itinerary, Leg, Mode } from '$lib/openapi';
	import { getColor } from './modeStyle';
	import polyline from 'polyline';
	import { colord } from 'colord';
	import { circlePolygon } from '$lib/circle';
	import type { Feature, Position } from 'geojson';

	const PRECISION = 7;

	function isIndividualTransport(m: Mode): boolean {
		return m == 'WALK' || m == 'BIKE' || m == 'CAR';
	}

	function getIntermediateCoordinates(l: Leg): number[][] {
		let c = new Array<Position>();
		if (l.intermediateStops !== undefined) {
			l.intermediateStops.forEach((s) => {
				c.push([s.lon, s.lat]);
			});
		}
		return c;
	}

	function getRidesharingCoordinates(l: Leg): number[][] {
		return [[l.from.lon, l.from.lat], ...getIntermediateCoordinates(l), [l.to.lon, l.to.lat]];
	}

	function getIntermediates(l: Leg) {
		return getIntermediateCoordinates(l).map((e) => {
			return {
							type: 'Feature',
							properties: {
								color: getColor(l)[0],
								intermediate: 1
							},
							geometry: {
								type: 'Polygon',
								coordinates: circlePolygon(e, 500)
							}
						};
		});
	}

	function itineraryToGeoJSON(i: Itinerary): GeoJSON.GeoJSON {
		let features = new Array<Feature>();

		for(const l of i.legs) {
			const color = isIndividualTransport(l.mode) ? '#42a5f5' : `${getColor(l)[0]}`;
			const outlineColor = colord(color).darken(0.2).toHex();
		if(l.mode === 'RIDE_SHARING') {
			features.push({
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
						});
			for(const i of getIntermediateCoordinates(l)) {
				features.push({
							type: 'Feature',
							properties: {
								color,
								intermediate: 1
							},
							geometry: {
								type: 'Polygon',
								coordinates: circlePolygon(i, 500)
							}
						})
			}
		} else {

		}

		}

		return {
			type: 'FeatureCollection',
			features: features
		};

		return {
			type: 'FeatureCollection',
			features: i.legs.flatMap((l) => {
				const color = isIndividualTransport(l.mode) ? '#42a5f5' : `${getColor(l)[0]}`;
				const outlineColor = colord(color).darken(0.2).toHex();

				if (l.mode === 'RIDE_SHARING') {
					console.log(JSON.stringify([						{
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
						}, ...getIntermediates(l)]));

					return [						{
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
						}, ...getIntermediates(l)];
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
		filter={['all', ['any', ['!has', 'level'], ['==', 'level', level]], ['!has', 'dashed'], ['!has','intermediate']]}
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
	<Layer
		id='ridesharing-intermediate'
		type='fill'
		layout={{}}
		filter={['has','intermediate']}
		paint={{
			'fill-color': ['get', 'color'],
			'fill-opacity': 1,
		}}
	/>
</GeoJSON>
