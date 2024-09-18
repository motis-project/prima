<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Select from "$lib/components/ui/select/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { type TourDetails } from '$lib/TourDetails.js';
	import ChevronLeft from "lucide-svelte/icons/chevron-left";
    import ChevronRight from "lucide-svelte/icons/chevron-right";
	import { ChevronsRight, ChevronsLeft, ChevronsUpDown } from 'lucide-svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import Label from '$lib/components/ui/label/label.svelte';
	import { Input } from '$lib/components/ui/input';
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
		setCompanys(rows);
  	});
	
	const setPage = (p: number) => {
		if (p >= 0 && p < totalPages.length) {
			page = p;
		}
		currentPageRows = totalPages.length > 0 ? totalPages[page] : [];
	};

	const sort = (des: boolean) => {

	};

	// --- Filter: ---
	let selected = $state("TaxiTaxi"); // Nicht hinbekommen.... bind:value ging nicht, wieso?
	//let companyName = $state('');
	let value = $state("");
	let selectvalues = [{value: "TaxiTaxi", label: "taxitaxi"}];
	let companys = $state(selectvalues);
	let notdouble: string[];
	const setCompanys = (tours: TourDetails[]) => {
		for(let tour of tours) {
			let stringifyname = tour.company_name + " ";
			if(!notdouble.includes(stringifyname))
			{
				notdouble.push(stringifyname);
				let temp = {value: stringifyname, label: stringifyname};
				companys.push(temp);
			}
		}
	};

	const filter = () => {

	};

</script>

<div class="flex justify-between">
	<Card.Header>
		<Card.Title>Abrechnung</Card.Title>
	</Card.Header>
	
	<div class="font-semibold leading-none tracking-tight p-6 flex gap-4">
		<Dialog.Root>
			<Dialog.Trigger class={buttonVariants({ variant: "outline" })}> 
				Filteroptionen
			</Dialog.Trigger>
			<Dialog.Content class="sm:max-w-[425px]">
			  <Dialog.Header>
				<Dialog.Title>Filteroptionen</Dialog.Title>
				<Dialog.Description>
				  Filteren Sie die Daten für eine bessere Übersicht.
				</Dialog.Description>
			  </Dialog.Header>
			  <div class="grid gap-4 py-4">
				<div class="grid grid-cols-4 items-center gap-4">
					<Label for="name" class="text-right">Filter nach Unternehmen:</Label>
				  	<Select.Root selected={value}>
						<Select.Trigger class="w-[280px]">
					  		<Select.Value placeholder="Wählen Sie ein Unternehmen" />
						</Select.Trigger>
						<Select.Content>
							{#each companys as company}
						  		<Select.Item value={company.value} label={company.label}>
									{company}
								</Select.Item>
							{/each}
						</Select.Content>
				  	</Select.Root>
				</div>
				<div class="grid grid-cols-4 items-center gap-4">
				  <Label for="timespan" class="text-right">Filter nach Zeitraum:</Label>
				  <Input id="timespan" value="01.01.2024" class="col-span-3" />
				</div>
			  </div>
			  <Dialog.Footer>
				<Button type="submit" on:click={() => filter()}>Filter anwenden</Button>
			  </Dialog.Footer>
			</Dialog.Content>
		  </Dialog.Root>
	</div>
</div>
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
