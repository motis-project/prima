<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table/index.js';
	import { type TourDetails } from '$lib/TourDetails.js';
	import ChevronLeft from "lucide-svelte/icons/chevron-left";
    import ChevronRight from "lucide-svelte/icons/chevron-right";
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
	
	let rows = [];
	let page = $state(0);
	let perPage = 2;
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
</script>

<div class="w-full h-full">
	<Card.Header>
		<Card.Title>Abrechnung</Card.Title>
	</Card.Header>
	<Card.Content class="w-full h-full">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Unternehmen</Table.Head>
					<Table.Head>Abfahrt</Table.Head>
					<Table.Head>Ankunft</Table.Head>
					<Table.Head>Anzahl Kunden</Table.Head>
					<Table.Head>Taxameterpreis</Table.Head>
                    <Table.Head>ÖV-Preis</Table.Head>
                    <Table.Head>Preis</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each currentPageRows as tour}
					<Table.Row>
						<Table.Cell>{tour.company_name}</Table.Cell>
						<Table.Cell>{tour.from.toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
						<Table.Cell>{tour.to.toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
						<Table.Cell>{getCustomerCount(tour)}</Table.Cell>
						<Table.Cell>TODO</Table.Cell>
                        <Table.Cell>TODO</Table.Cell>
                        <Table.Cell>TODO</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Content>
</div>
<div>
	<Button variant="outline" on:click={() => setPage(page - 1)}>
		<ChevronLeft class="h-4 w-4" />
		Vorherige Seite
	</Button>
	{#if totalPages.length > 5}
		{#each {length: 2} as _, i}
			<Button variant="outline" on:click={() => setPage(i)}>
				{i + 1}
			</Button>	
		{/each}
		...
		<Button variant="outline" on:click={() => setPage(totalPages.length-2)}>
			{totalPages.length-1}
		</Button>	
		<Button variant="outline" on:click={() => setPage(totalPages.length-1)}>
			{totalPages.length}
		</Button>	
	{:else}
		{#each totalPages as page, i}
			<Button variant="outline" on:click={() => setPage(i)}>
				{i + 1}
			</Button>		
		{/each}
	{/if}
	<Button variant="outline" on:click={() => setPage(page + 1)}>
		Nächste Seite
		<ChevronRight class="h-4 w-4" />
	</Button>
	<Label>
		Auf Seite {page+1} von {totalPages.length}
	</Label>
</div>
