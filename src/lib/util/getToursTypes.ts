import type { getToursWithRequests } from '$lib/server/db/getTours';

export type ToursWithRequests = Awaited<ReturnType<typeof getToursWithRequests>>;
export type TourWithRequests = ToursWithRequests[0];
export type TourRequest = TourWithRequests['requests'][0];
