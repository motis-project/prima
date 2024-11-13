//<script lang="ts">
	import { type TourDetails } from '$lib/TourDetails.js';
	// import { onMount } from 'svelte';
	// import ChevronLeft from 'lucide-svelte/icons/chevron-left';
	// import ChevronRight from 'lucide-svelte/icons/chevron-right';
	// import { ChevronsRight, ChevronsLeft } from 'lucide-svelte';
	// import { Button } from '$lib/components/ui/button';
	// import Label from '$lib/components/ui/label/label.svelte';

	//let currentRows: TourDetails[] = [];
	// let page = $state(0);
	//let perPage = 15;
	// let firstPage = tours.slice(0, perPage);
	// let firstarray = [firstPage];
	// let totalPages = $state(firstarray);
	// let currentPageRows = $state(firstPage);

	// return totalPages
	export function paginate(perPage: number, tours: TourDetails[]) {
		const pagesCount = Math.ceil(tours.length / perPage);
		const paginatedItems = Array.from({ length: pagesCount }, (_, index) => {
			const start = index * perPage;
			return tours.slice(start, start + perPage);
		});
		return [...paginatedItems];
	};

	// onMount(() => {
	// 	currentRows = tours;
	// 	paginate(currentRows);
	// });

	// return currentPageRows
	export function setPage(p: number, totalPages: TourDetails[][]) {
		if (p >= 0 && p < totalPages.length) {
			return totalPages.length > 0 ? totalPages[p] : [];
		}
		return [];
	};
//</script>
