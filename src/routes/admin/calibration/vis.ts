import type { CalibrationItinerary } from '$lib/calibration';
import type { Itinerary, Leg } from '$lib/openapi';
import type { VisualizationPackage } from '$lib/util/filterTaxis';
import { usesTaxi } from '$lib/util/itineraryHelpers';
import * as Plot from '@observablehq/plot';
import * as d3 from 'd3';

export function vis(
	results: {
		itineraries: Array<CalibrationItinerary>;
		visualize?: VisualizationPackage;
	},
	div: HTMLElement | null,
	getCost: (i: Itinerary) => number
) {
	if (results === undefined || results.visualize === undefined) {
		return;
	}

	const getCenter = (i: CalibrationItinerary) => {
		const s = new Date(i.startTime);
		const e = new Date(i.endTime);
		return new Date(s.getTime() + (e.getTime() - s.getTime()) / 2);
	};

	const plot = Plot.plot({
		width: div?.clientWidth,
		height: div?.clientHeight,
		style: 'overflow: visible; font-size: .8em;',
		grid: true,
		x: { type: 'time', label: 'time', tickFormat: d3.timeFormat('%H:%M') },
		y: { label: 'cost' },
		marks: [
			Plot.ruleY([0]),
			Plot.lineY(results.visualize.thresholds, {
				x: 'time',
				y: 'pt',
				stroke: 'blue',
				opacity: 0.5
			}),
			Plot.lineY(results.visualize.thresholds, {
				x: 'time',
				y: 'taxi',
				stroke: 'yellow',
				opacity: 0.5
			}),
			// Plot.lineY(results.itineraries.reduce((acc, val) => acc.concat(val.legs), new Array<Leg>())),
			Plot.dot(results.itineraries, {
				x: (i: CalibrationItinerary) => getCenter(i),
				y: (i: CalibrationItinerary) => getCost(i),
				stroke: (i: CalibrationItinerary) => (usesTaxi(i) ? 'yellow' : 'blue'),
				channels: {
					departure: (i: CalibrationItinerary) =>
						d3.timeFormat('%Y-%m-%d %H:%M%Z')(new Date(i.startTime)),
					arrival: (i: CalibrationItinerary) =>
						d3.timeFormat('%Y-%m-%d %H:%M%Z')(new Date(i.endTime)),
					transfers: 'transfers',
					usesTaxi: (i: CalibrationItinerary) => usesTaxi(i)
				},
				tip: {
					color: 'white',
					fill: 'black',
					format: {
						x: d3.timeFormat('%Y-%m-%d %H:%M%Z'),
						y: true
					}
				}
			})
		],
		legend: true
	});
	div?.replaceChildren(plot);
}
