import type { getTours, getToursWithRequests } from '$lib/server/db/getTours';

export type Tours = Awaited<ReturnType<typeof getTours>>;
export type Tour = Tours[0];
export type TourEvent = Tour['events'][0];

export type ToursWithRequests = Awaited<ReturnType<typeof getToursWithRequests>>;
export type TourWithRequests = ToursWithRequests[0];
export type TourRequest = TourWithRequests['requests'][0];
export type TourWithRequestsEvent = TourRequest['events'][0];
