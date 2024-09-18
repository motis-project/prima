<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table/index.js';
	import { type TourDetails } from '$lib/TourDetails.js';
	import ChevronLeft from "lucide-svelte/icons/chevron-left";
    import ChevronRight from "lucide-svelte/icons/chevron-right";
	import { ChevronsRight, ChevronsLeft, ChevronsUpDown } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import Label from '$lib/components/ui/label/label.svelte';
	import { onMount } from "svelte";

    const { data } = $props();

	const getCustomerCount = (tour: TourDetails) => {
		let customers: Set<string> = new Set<string>();
		tour.events.forEach((e) => {
			customers.add(e.customer_id!);
		});
		return customers.size;
	};

	// fare = ÖV-Preis  ---  fare_route = Taxameterpreis
	const getTotalPrice = (fare: number | null, fare_route: number | null) => {
		if(fare == null || fare_route == null) {
			return 0;
		}
		return fare + fare_route;
	};

	const getCost = (fare: number | null, fare_route: number | null) => {
		if(fare == null || fare_route == null) {
			return 0;
		}
		return (fare_route - fare) * 0.97;
	};
	
	let rows = [];
	let page = $state(0);
	let perPage = 5;
	let firstPage = data.tours.slice(0, perPage);
	let firstarray = [firstPage];
	let totalPages = $state(firstarray);
	let currentPageRows = $state(firstPage);
	
	const paginate = (tours: TourDetails[]) => {
		const pagesCount = Math.ceil(tours.length / perPage);
		const paginatedItems = Array.from({ length: pagesCount }, (_, index) => {
			const start = index * perPage;
			return tours.slice(start, start + perPage);
			});
		totalPages = [...paginatedItems];
  	};
	
	onMount(() => {
		rows = data.tours;
    	paginate(rows);
  	});
	
	const setPage = (p: number) => {
		if (p >= 0 && p < totalPages.length) {
			page = p;
		}
		currentPageRows = totalPages.length > 0 ? totalPages[page] : [];
	}

	const sort = (des: boolean) => {

	}
</script>

<div class="w-full h-full">
	<Card.Header>
		<Card.Title>Abrechnung</Card.Title>
	</Card.Header>
	<Card.Content class="w-full h-full">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="mt-6.5">Unternehmen</Table.Head>
					<Table.Head class="mt-6 flex justify-start">
						Abfahrt
						<ChevronsUpDown class="mx-2 size-5" on:click={() => sort(true)}></ChevronsUpDown>
					</Table.Head>
					<Table.Head class="mt-6.5">Ankunft</Table.Head>
					<Table.Head class="mt-6.5">Anzahl Kunden</Table.Head>
					<Table.Head class="mt-6.5">Taxameterpreis</Table.Head>
                    <Table.Head class="mt-6.5">ÖV-Preis</Table.Head>
                    <Table.Head class="mt-6 flex justify-start">
						Gesamtpreis
						<ChevronsUpDown class="mx-2 size-5" on:click={() => sort(true)}></ChevronsUpDown>
					</Table.Head>
					<Table.Head class="mt-6">
						Kosten
						<ChevronsUpDown class="mx-2 size-5" on:click={() => sort(true)}></ChevronsUpDown>
					</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each currentPageRows as tour}
					<Table.Row>
						<Table.Cell>{tour.company_name}</Table.Cell>
						<Table.Cell>{tour.from.toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
						<Table.Cell>{tour.to.toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
						<Table.Cell>{getCustomerCount(tour)}</Table.Cell>
						<Table.Cell>{tour.fare_route} €</Table.Cell>
                        <Table.Cell>{tour.fare} €</Table.Cell>
                        <Table.Cell>{getTotalPrice(tour.fare, tour.fare_route)} €</Table.Cell>
						<Table.Cell>{getCost(tour.fare, tour.fare_route)} €</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Content>
</div>
<div class="flex justify-center">
	{#if totalPages.length > 10}
		<Button variant="outline" on:click={() => setPage(0)}>
			<ChevronsLeft class="mx-1 h-4 w-4" />
			Erste Seite
		</Button>	
		<Button variant="outline" on:click={() => setPage(page - 1)}>
			<ChevronLeft class="h-4 w-4" />
			Vorherige
		</Button>
		<Button variant="outline" on:click={() => setPage(page + 1)}>
			Nächste
			<ChevronRight class="h-4 w-4" />
		</Button>
		<Button variant="outline" on:click={() => setPage(totalPages.length-1)}>
			Letzte Seite
			<ChevronsRight class="mx-1 h-4 w-4" />
		</Button>	
	{:else}
		<Button variant="outline" on:click={() => setPage(page - 1)}>
			<ChevronLeft class="h-4 w-4" />
			Vorherige Seite
		</Button>
		{#each totalPages as page, i}
			<Button variant="outline" on:click={() => setPage(i)}>
				{i + 1}
			</Button>		
		{/each}
		<Button variant="outline" on:click={() => setPage(page + 1)}>
			Nächste Seite
			<ChevronRight class="h-4 w-4" />
		</Button>
	{/if}
	<Label class="mx-2 mt-2.5">
		Auf Seite {page+1} von {totalPages.length}
	</Label>
</div>
