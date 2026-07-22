import { type Itinerary } from '$lib/openapi';
import { isTaxiLeg } from './booking/checkLegType';
import { isDirectTaxi, publicTransitOnly, usesTaxi } from './itineraryHelpers';

const meanWindowSize = 60;

export type VisualizationPackage = {
	thresholds: Array<{ time: Date; pt: number; taxi: number }>;
};

export function getCostFn<T extends Itinerary>(
	perTransfer: number,
	taxiBase: number,
	taxiPerMinute: number,
	taxiDirectPenalty: number
): (i: T) => number {
	return (i: T): number => {
		let cost =
			Math.round(i.duration / 60) +
			i.transfers * perTransfer +
			(isDirectTaxi(i) ? taxiDirectPenalty : 0);
		i.legs.forEach((l) => {
			if (isTaxiLeg(l)) {
				cost -= Math.round(l.duration / 60);
				cost += taxiBase + Math.round(l.duration / 60) * taxiPerMinute;
			}
		});
		return cost;
	};
}

export function filterTaxis<T extends Itinerary>(
	itineraries: Array<T>,
	perTransfer: number,
	taxiBase: number,
	taxiPerMinute: number,
	taxiDirectPenalty: number,
	ptSlope: number,
	taxiSlope: number,
	visualize = false
): { itineraries: Array<T>; visualize?: VisualizationPackage } {
	if (itineraries.length == 0) {
		return { itineraries: itineraries };
	}

	const getCost = getCostFn(perTransfer, taxiBase, taxiPerMinute, taxiDirectPenalty);

	const start = getStart(itineraries);
	const end = getEnd(itineraries);

	const getCenter = (i: T): number => {
		return Math.round((new Date(i.startTime).getTime() + (i.duration * 1000) / 2) / 60000) - start;
	};

	const getThreshold = (is: Array<T>, slope: number): Array<number> => {
		const threshold = new Array<number>(end - start);
		threshold.fill(Number.POSITIVE_INFINITY);

		for (const i of is) {
			const cost = getCost(i);
			const center = getCenter(i);
			const localThreshold = (t: number): number => {
				return slope * Math.abs(center - t) + cost;
			};
			threshold.forEach((value, index) => {
				threshold[index] = Math.min(value, localThreshold(index));
			});
		}

		averageDamping(threshold);

		return threshold;
	};

	const ptThreshold = getThreshold(
		itineraries.filter((i) => publicTransitOnly(i)),
		ptSlope
	);
	const afterPtThreshold = itineraries.filter(
		(i) => !usesTaxi(i) || getCost(i) <= ptThreshold[getCenter(i)]
	);

	const taxiThreshold = getThreshold(
		afterPtThreshold.filter((i) => usesTaxi(i)),
		taxiSlope
	);
	const afterTaxiThreshold = afterPtThreshold.filter(
		(i) => !usesTaxi(i) || getCost(i) <= taxiThreshold[getCenter(i)]
	);

	if (visualize) {
		return {
			itineraries: afterTaxiThreshold,
			visualize: getVisualizationPackage(itineraries, ptThreshold, taxiThreshold)
		};
	} else {
		return { itineraries: afterTaxiThreshold };
	}
}

function getStart<T extends Itinerary>(itineraries: Array<T>): number {
	return Math.floor(new Date(itineraries[0].startTime).getTime() / 60000) - meanWindowSize / 2;
}

function getEnd<T extends Itinerary>(itineraries: Array<T>): number {
	return (
		Math.ceil(new Date(itineraries[itineraries.length - 1].endTime).getTime() / 60000) +
		meanWindowSize / 2
	);
}

function getVisualizationPackage<T extends Itinerary>(
	itineraries: Array<T>,
	ptThreshold: Array<number>,
	taxiTreshold: Array<number>
): VisualizationPackage {
	return { thresholds: getThresholds(itineraries, ptThreshold, taxiTreshold) };
}

function getThresholds<T extends Itinerary>(
	itineraries: Array<T>,
	ptThreshold: Array<number>,
	taxiTreshold: Array<number>
): Array<{ time: Date; pt: number; taxi: number }> {
	const start = getStart(itineraries);
	const thresholds = new Array<{ time: Date; pt: number; taxi: number }>();
	for (let i = 0; i < ptThreshold.length && i < taxiTreshold.length; ++i) {
		thresholds.push({
			time: new Date((start + i) * 60000),
			pt: ptThreshold[i],
			taxi: taxiTreshold[i]
		});
	}
	return thresholds;
}

function averageDamping(a: Array<number>) {
	const mean = a.reduce((s, v) => s + v, 0) / a.length;
	for (let i in a) {
		a[i] = Math.min(a[i], mean);
	}
}
