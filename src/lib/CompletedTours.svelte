<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table/index.js';
	import { getTourInfoShort, type TourDetails } from '$lib/TourDetails.js';
	import TourDialog from '$lib/TourDialog.svelte';
	import { onMount } from 'svelte';
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';
	import ChevronRight from 'lucide-svelte/icons/chevron-right';
	import { ChevronsRight, ChevronsLeft } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import Label from '$lib/components/ui/label/label.svelte';
	// ---------------------------------------
	import { isPageValid, paginate, setCurrentPages } from '$lib/Paginate';

	type Props = {
		isMaintainer: boolean;
		tours: TourDetails[];
	};
	let { isMaintainer, tours }: Props = $props();

	let selectedTour = $state<{
		tours: Array<TourDetails> | undefined;
	}>({ tours: undefined });

	const getCustomerCount = (tour: TourDetails) => {
		let customers: Set<string> = new Set<string>();
		tour.events.forEach((e) => {
			customers.add(e.customer_id!);
		});
		return customers.size;
	};

	// --- Pageination ---
	let currentRows: TourDetails[] = [];
	let page = $state(0);
	let perPage = 5;
	let firstPage = tours.slice(0, perPage);
	let firstarray = [firstPage];
	let totalPages = $state(firstarray);
	let currentPageRows = $state(firstPage);

	// const paginate = (tours: TourDetails[]) => {
	// 	const pagesCount = Math.ceil(tours.length / perPage);
	// 	const paginatedItems = Array.from({ length: pagesCount }, (_, index) => {
	// 		const start = index * perPage;
	// 		return tours.slice(start, start + perPage);
	// 	});
	// 	totalPages = [...paginatedItems];
	// };

	onMount(() => {
		currentRows = tours;
		//paginate(currentRows);
		totalPages = paginate(perPage, currentRows);
	});

	// const setPage = (p: number) => {
	// 	if (p >= 0 && p < totalPages.length) {
	// 		page = p;
	// 	}
	// 	currentPageRows = totalPages.length > 0 ? totalPages[page] : [];
	// };

	const getTotalPrice = (fare: number | null, fare_route: number | null) => {
		if (fare == null || fare_route == null) {
			return 0;
		}
		let cost = 0;
		let diff = Math.max(0, fare_route - fare);
		if (diff > 0) {
			cost = (fare_route - fare) * 0.97;
		}
		return (Math.round(fare + cost) / 100).toFixed(2);
	};
</script>

<div class="w-full h-full">
	<Card.Header>
		<Card.Title>Abgeschlossene Fahrten</Card.Title>
	</Card.Header>
	<Card.Content class="w-full h-full">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					{#if isMaintainer}
						<Table.Head>Unternehmen</Table.Head>
					{:else}
						<Table.Head>Fahrzeug</Table.Head>
					{/if}
					<Table.Head>Von</Table.Head>
					<Table.Head>Nach</Table.Head>
					<Table.Head>Abfahrt</Table.Head>
					<Table.Head>Ankunft</Table.Head>
					<Table.Head>Anzahl Kunden</Table.Head>
					<Table.Head>No-Show</Table.Head>
					<Table.Head>Anzahl Stationen</Table.Head>
					<Table.Head>Gesamtfahrpreis</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each currentPageRows as tour}
					<Table.Row
						on:click={() => {
							selectedTour = { tours: [tour] };
						}}
						class="cursor-pointer"
					>
						{#if isMaintainer}
							<Table.Cell>{tour.company_name}</Table.Cell>
						{:else}
							<Table.Cell>{tour.license_plate}</Table.Cell>
						{/if}
						<Table.Cell>{getTourInfoShort(tour)[0]}</Table.Cell>
						<Table.Cell>{getTourInfoShort(tour)[1]}</Table.Cell>
						<Table.Cell>{tour.from.toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
						<Table.Cell>{tour.to.toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
						<Table.Cell class="text-center">{getCustomerCount(tour)}</Table.Cell>
						<Table.Cell>TODO</Table.Cell>
						<Table.Cell class="text-center">{tour.events.length}</Table.Cell>
						<Table.Cell class="text-center"
							>{getTotalPrice(tour.fare, tour.fare_route)} €</Table.Cell
						>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Content>
</div>

<!-- setPage(0); ... setPage(page - 1); etc. -->
<div class="flex justify-center">
	{#if totalPages.length > 10}
		<Button
			variant="outline"
			on:click={() => {
				page = 0;
				currentPageRows = setCurrentPages(page, totalPages);
			}}
		>
			<ChevronsLeft class="mx-1 h-4 w-4" />
			Erste Seite
		</Button>
		<Button
			variant="outline"
			on:click={() => {
				page = isPageValid(page - 1, totalPages.length) ? page - 1 : page;
				currentPageRows = setCurrentPages(page, totalPages);
			}}
		>
			<ChevronLeft class="h-4 w-4" />
			Vorherige
		</Button>
		<Button
			variant="outline"
			on:click={() => {
				page = isPageValid(page + 1, totalPages.length) ? page + 1 : page;
				currentPageRows = setCurrentPages(page, totalPages);
			}}
		>
			Nächste
			<ChevronRight class="h-4 w-4" />
		</Button>
		<Button
			variant="outline"
			on:click={() => {
				page = totalPages.length - 1;
				currentPageRows = setCurrentPages(page, totalPages);
			}}
		>
			Letzte Seite
			<ChevronsRight class="mx-1 h-4 w-4" />
		</Button>
	{:else}
		<Button
			variant="outline"
			on:click={() => {
				page = isPageValid(page - 1, totalPages.length) ? page - 1 : page;
				currentPageRows = setCurrentPages(page, totalPages);
			}}
		>
			<ChevronLeft class="h-4 w-4" />
			Vorherige Seite
		</Button>
		{#each totalPages as _page, i}
			<Button
				variant="outline"
				on:click={() => {
					page = i;
					currentPageRows = setCurrentPages(page, totalPages);
				}}
			>
				{i + 1}
			</Button>
		{/each}
		<Button
			variant="outline"
			on:click={() => {
				page = isPageValid(page + 1, totalPages.length) ? page + 1 : page;
				currentPageRows = setCurrentPages(page, totalPages);
			}}
		>
			Nächste Seite
			<ChevronRight class="h-4 w-4" />
		</Button>
	{/if}
	<Label class="mx-2 mt-2.5">
		Auf Seite {page + 1} von {totalPages.length}
	</Label>
</div>

<TourDialog bind:open={selectedTour} />
