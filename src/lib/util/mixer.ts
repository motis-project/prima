import { type Itinerary } from '$lib/openapi';
import { isTaxiLeg } from './booking/checkLegType';
import { isDirectTaxi } from './itineraryHelpers';

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

	const cost = (i: Itinerary): number => {
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

	const start = new Date(itineraries[0].startTime);
	const end = new Date(itineraries[itineraries.length - 1].endTime);
}
