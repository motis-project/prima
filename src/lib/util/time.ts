import { PUBLIC_SIMULATION_TIME } from "$env/static/public";

export const SECOND = 1000;
export const MINUTE = SECOND * 60;
export const HOUR = MINUTE * 60;
export const DAY = HOUR * 24;

export function milliToSecond(milli: number): number {
	return Math.floor(milli / SECOND);
}

export function secondToMilli(second: number): number {
	return second * SECOND;
}

export function nowOrSimulationTime() {
    if(PUBLIC_SIMULATION_TIME) {
        console.log("PUBLIC_SIMULATION_TIME: " + PUBLIC_SIMULATION_TIME);
    }
    return PUBLIC_SIMULATION_TIME ? new Date(PUBLIC_SIMULATION_TIME) : new Date();
}