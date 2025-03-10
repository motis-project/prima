import { PUBLIC_SIMULATION_TIME } from "$env/static/public";

export function nowOrSimulationTime() {
    console.log(PUBLIC_SIMULATION_TIME ? "PUBLIC_SIMULATION_TIME: " + PUBLIC_SIMULATION_TIME : "now: " + new Date());
    return PUBLIC_SIMULATION_TIME ? new Date(PUBLIC_SIMULATION_TIME) : new Date();
}