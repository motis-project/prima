import { db } from '../db';
import { getRideShareTourByRequest, type RideShareEvent } from './getRideShareTours';
import { oneToManyCarRouting } from '../util/oneToManyCarRouting';
import { PASSENGER_CHANGE_DURATION } from '$lib/constants';

export async function acceptRideShareRequest(
	requestId: number,
	customer: number,
	provider: number
) {
    let message = undefined;
    db.transaction()
	.setIsolationLevel('serializable')
    .execute(async (trx) => {
	    const tours = await getRideShareTourByRequest(requestId,trx);
        if(tours.length === 0) {
            return;
        }
        const tour = tours[0];
        if(tour.provider !== provider) {

        }
        const newEvents = tour.events.filter((e) => e.requestId === requestId);
        if(newEvents.length === 0) {

        }
        if(newEvents[0].customer !== customer) {

        }
        if(await isTourValid(tour.events)) {

        } else {

        }
    });
}

async function isTourValid(events: RideShareEvent[]) {
    const queries = [];
    for(let i=1;i!=events.length;++i) {
        const prevEvent = events[i-1];
        const event = events[i];
        queries.push(oneToManyCarRouting(prevEvent, [event], false));
    }
    const durations = await Promise.all(queries);
    if(durations.some((d, idx) => d.length === 0 || d[0] === undefined || d[0] + PASSENGER_CHANGE_DURATION > events[idx].prevLegDuration)) {
        
    }
    return false;//TODO
}