import { type Itinerary } from '$lib/openapi';
import { isTaxiLeg } from './booking/checkLegType';
import { isDirectTaxi, publicTransitOnly, usesTaxi } from './itineraryHelpers';

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
		return (
			i.legs
				.map((l) =>
					isTaxiLeg(l)
						? taxiBase + Math.round(l.duration / 60) * taxiPerMinute
						: Math.round(l.duration / 60)
				)
				.reduce((acc, val) => acc + val, 0) +
			i.transfers * perTransfer +
			(isDirectTaxi(i) ? taxiDirectPenalty : 0)
		);
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
		let threshold = new Array<number>(end - start);
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
	const taxiThreshold = getThreshold(
		itineraries.filter((i) => usesTaxi(i)),
		taxiSlope
	);

	const filteredItineraries = itineraries.filter(
		(i) =>
			!usesTaxi(i) ||
			(getCost(i) <= ptThreshold[getCenter(i)] && getCost(i) <= taxiThreshold[getCenter(i)])
	);

	if (visualize) {
		return {
			itineraries: filteredItineraries,
			visualize: getVisualizationPackage(itineraries, ptThreshold, taxiThreshold)
		};
	} else {
		return { itineraries: filteredItineraries };
	}
}

function getStart<T extends Itinerary>(itineraries: Array<T>): number {
	return Math.floor(new Date(itineraries[0].startTime).getTime() / 60000);
}

function getEnd<T extends Itinerary>(itineraries: Array<T>): number {
	return Math.ceil(new Date(itineraries[itineraries.length - 1].endTime).getTime() / 60000);
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
	let thresholds = new Array<{ time: Date; pt: number; taxi: number }>();
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
	const isMinimum = (a: Array<number>, i: number): boolean => {
		return (i === 0 || a[i] <= a[i - 1]) && (i === a.length - 1 || a[i] <= a[i + 1]);
	};

	const getNextMinimum = (a: Array<number>, i: number) => {
		for (; i < a.length; ++i) {
			if (isMinimum(a, i)) {
				break;
			}
		}
		return i;
	};

	const getAverage = (a: Array<number>, i: number, j: number): number => {
		let acc = 0;
		for (let k = i; k <= j; ++k) {
			acc += a[k];
		}
		return acc / (j - i + 1);
	};

	let i = getNextMinimum(a, 0);
	while (i < a.length - 1) {
		let j = getNextMinimum(a, i + 1);
		if (j === a.length) {
			break;
		}

		const avg = getAverage(a, i, j);
		for (let k = i; k <= j; ++k) {
			a[k] = Math.min(a[k], avg);
		}

		i = j;
	}
}
