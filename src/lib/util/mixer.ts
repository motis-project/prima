import { type Itinerary } from '$lib/openapi';
import { isTaxiLeg } from './booking/checkLegType';
import { isDirectTaxi, publicTransitOnly, usesTaxi } from './itineraryHelpers';

export function mix(
	itineraries: Array<Itinerary>,
	baseTaxi: number,
	perTaxiMinute: number,
	perTransfer: number,
	directTaxiPenalty: number,
	ptSlope: number,
	taxiSlope: number
): [Array<Itinerary>, Array<number>, Array<number>] {
	if (itineraries.length == 0) {
		return [itineraries, [], []];
	}

	const getCost = (i: Itinerary): number => {
		return (
			i.legs
				.map((l) =>
					isTaxiLeg(l)
						? baseTaxi + Math.round(l.duration / 60) * perTaxiMinute
						: Math.round(l.duration / 60)
				)
				.reduce((acc, val) => acc + val, 0) +
			i.transfers * perTransfer +
			(isDirectTaxi(i) ? directTaxiPenalty : 0)
		);
	};

	const start = Math.floor(new Date(itineraries[0].startTime).getTime() / 60000);
	const end = Math.ceil(new Date(itineraries[itineraries.length - 1].endTime).getTime() / 60000);

	const getIndex = (t: Date) => {
		return Math.round(t.getTime() / 60000) - start;
	};

	const getCenter = (i: Itinerary): Date => {
		return new Date(
			Math.round((new Date(i.startTime).getTime() + (i.duration * 1000) / 2) / 60000) * 60000
		);
	};

	const getThreshold = (is: Array<Itinerary>, slope: number): Array<number> => {
		let threshold = new Array<number>(end - start);
		threshold.fill(Number.POSITIVE_INFINITY);

		for (const i of is) {
			const cost = getCost(i);
			const center = getCenter(i);
			const localThreshold = (t: Date): number => {
				return slope * Math.abs(Math.round((center.getTime() - t.getTime()) / 60000)) + cost;
			};
		}

		return threshold;
	};

	const ptItineraries = itineraries.filter((i) => publicTransitOnly(i));
	const ptThreshold = getThreshold(ptItineraries, ptSlope);
	const taxiItineraries = itineraries.filter((i) => usesTaxi(i));
	const taxiThreshold = getThreshold(taxiItineraries, taxiSlope);

	return [itineraries, ptThreshold, taxiThreshold];
}
