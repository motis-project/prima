import { type Itinerary } from './openapi';

export type CalibrationItinerary = Itinerary & {
	required: boolean;
	forbidden: boolean;
};
