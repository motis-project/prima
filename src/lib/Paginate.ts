import { type TourDetails } from '$lib/TourDetails.js';

// return totalPages
export function paginate(perPage: number, tours: TourDetails[]) {
	const pagesCount = Math.ceil(tours.length / perPage);
	const paginatedItems = Array.from({ length: pagesCount }, (_, index) => {
		const start = index * perPage;
		return tours.slice(start, start + perPage);
	});
	return [...paginatedItems];
}

// return page
export function isPageValid(p: number, length: number) {
	return p >= 0 && p < length;
}

// return currentPageRows
export function setCurrentPages(p: number, totalPages: TourDetails[][]) {
	if (isPageValid(p,totalPages.length)) {
		return totalPages.length > 0 ? totalPages[p] : [];
	}
	return [];
}
