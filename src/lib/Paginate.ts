// return totalPages
export function paginate<T>(perPage: number, tours: T[]): T[][] {
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
export function setCurrentPages<T>(p: number, totalPages: T[][]) {
	if (isPageValid(p, totalPages.length)) {
		return totalPages.length > 0 ? totalPages[p] : [];
	}
	return [];
}
