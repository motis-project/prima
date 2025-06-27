import type { Coordinates } from '../Coordinates';

export type Condition = {
	evalAfterStep: number;
	entity: string;
	company: Coordinates | null;
	start: Coordinates | null;
	destination: Coordinates | null;
	expectedPosition: number | null;
	tourCount: number | null;
	requestCount: number | null;
};

export type TestProcess = {
	companies: Coordinates[];
	starts: Coordinates[];
	destinations: Coordinates[];
	times: number[];
	isDepartures: boolean[];
};

export type TestParams = {
	process: TestProcess;
	conditions: Condition[];
	uuid: string;
};
