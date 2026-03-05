import type { CalibrationItinerary } from '$lib/calibration';
import type { Itinerary } from '$lib/openapi';
import { isTaxiLeg } from '$lib/util/booking/checkLegType';
import type { VisualizationPackage } from '$lib/util/filterTaxis';
import { usesTaxi } from '$lib/util/itineraryHelpers';
import * as Plot from '@observablehq/plot';
import * as d3 from 'd3';

export const colorPT = '#0247ec';
export const colorTaxi = '#fdb813';

export function vis(
	is: Array<CalibrationItinerary>,
	v: VisualizationPackage,
	div: HTMLElement,
	getCost: (i: Itinerary) => number
) {
	const getCenter = (i: CalibrationItinerary) => {
		const s = new Date(i.startTime);
		const e = new Date(i.endTime);
		return new Date(s.getTime() + (e.getTime() - s.getTime()) / 2);
	};

	const legVisData = getLegVisData(is, getCost);

	const plot = Plot.plot({
		width: div?.clientWidth,
		height: div?.clientHeight,
		style: 'overflow: visible; font-size: .8em;',
		grid: true,
		x: { type: 'time', label: 'time', tickFormat: d3.timeFormat('%H:%M') },
		y: { label: 'cost' },
		marks: [
			Plot.ruleY([0]),
			Plot.lineY(v.thresholds, {
				x: 'time',
				y: 'pt',
				stroke: colorPT,
				opacity: 0.5
			}),
			Plot.text(
				v.thresholds,
				Plot.selectFirst({
					x: 'time',
					y: 'pt',
					text: ['PT'],
					textAnchor: 'start',
					fill: colorPT,
					fontWeight: 'bold',
					dx: 5
				})
			),
			Plot.lineY(v.thresholds, {
				x: 'time',
				y: 'taxi',
				stroke: colorTaxi,
				opacity: 0.5,
				strokeDasharray: 5
			}),
			Plot.text(
				v.thresholds,
				Plot.selectFirst({
					x: 'time',
					y: 'taxi',
					text: ['Taxi'],
					textAnchor: 'start',
					fill: colorTaxi,
					fontWeight: 'bold',
					dx: 5,
					dy: 0
				})
			),
			Plot.lineY(legVisData, { x: 'time', y: 'cost', z: 'id', stroke: 'color', opacity: 0.5 }),
			Plot.dot(is, {
				x: (i: CalibrationItinerary) => getCenter(i),
				y: (i: CalibrationItinerary) => getCost(i),
				stroke: (i: CalibrationItinerary) => (usesTaxi(i) ? colorTaxi : colorPT),
				fill: (i: CalibrationItinerary) => (usesTaxi(i) ? colorTaxi : colorPT),
				symbol: (i: CalibrationItinerary) => (usesTaxi(i) ? 'square' : 'circle'),
				channels: {
					departure: (i: CalibrationItinerary) =>
						d3.timeFormat('%Y-%m-%d %H:%M%Z')(new Date(i.startTime)),
					arrival: (i: CalibrationItinerary) =>
						d3.timeFormat('%Y-%m-%d %H:%M%Z')(new Date(i.endTime)),
					travelTime: (i: CalibrationItinerary) => i.duration / 60 + ' min',
					transfers: 'transfers',
					taxiFirstMile: (i: CalibrationItinerary) =>
						(i.legs.length > 0 && isTaxiLeg(i.legs[0]) ? i.legs[0].duration : 0) / 60 + ' min',
					taxiLastMile: (i: CalibrationItinerary) =>
						(i.legs.length > 1 && isTaxiLeg(i.legs[i.legs.length - 1])
							? i.legs[i.legs.length - 1].duration
							: 0) /
							60 +
						' min',
					keep: (i: CalibrationItinerary) => i.keep,
					remove: (i: CalibrationItinerary) => i.remove,
					fulfilled: (i: CalibrationItinerary) => i.fulfilled
				},
				tip: {
					fill: 'black',
					format: {
						x: d3.timeFormat('%Y-%m-%d %H:%M%Z'),
						y: true,
						symbol: false
					}
				}
			}),
			Plot.dot(
				is.filter((i) => !i.fulfilled),
				{
					x: (i: CalibrationItinerary) => getCenter(i),
					y: (i: CalibrationItinerary) => getCost(i),
					r: 5,
					stroke: 'red',
					strokeWidth: 3,
					symbol: 'times'
				}
			)
		]
	});
	div?.replaceChildren(plot);
}

type LegVisData = {
	time: Date;
	cost: number;
	color: string;
	id: number;
};

function getLegVisData<T extends Itinerary>(
	is: Array<T>,
	getCost: (i: Itinerary) => number
): Array<LegVisData> {
	const ret = new Array<LegVisData>();
	const addLegVis = (start: Date, end: Date, cost: number, color: string, id: number) => {
		ret.push(
			{ time: start, cost: cost, color: color, id: id },
			{ time: end, cost: cost, color: color, id: id }
		);
	};

	is.forEach((i, iI) => {
		const cost = getCost(i);
		const iStart = new Date(i.startTime);
		const iEnd = new Date(i.endTime);

		i.legs.forEach((l, lI) => {
			const lStart = new Date(l.startTime);
			const lEnd = new Date(l.endTime);

			if (lI === 0 && iStart < lStart) {
				addLegVis(iStart, lStart, cost, colorPT, iI);
			}

			if (lI > 0) {
				const lPrevEnd = new Date(i.legs[lI - 1].endTime);
				if (lPrevEnd < lStart) {
					addLegVis(lPrevEnd, lStart, cost, colorPT, iI);
				}
			}

			addLegVis(lStart, lEnd, cost, isTaxiLeg(l) ? colorTaxi : colorPT, iI);

			if (lI === i.legs.length - 1 && lEnd < iEnd) {
				addLegVis(lEnd, lEnd, cost, colorPT, iI);
			}
		});
	});
	return ret;
}
