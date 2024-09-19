<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { type TourDetails } from '$lib/TourDetails.js';
	import ChevronLeft from "lucide-svelte/icons/chevron-left";
    import ChevronRight from "lucide-svelte/icons/chevron-right";
	import { ChevronsRight, ChevronsLeft, ChevronsUpDown } from 'lucide-svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
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

	// --- Sortierung: ---
	const sort = (des: boolean) => {

	};

	// --- Filter: ---
	let selectedCompany = $state("Unternehmen");
	let companys = $state([data.tours.at(0)?.company_name]);
	const setCompanys = (tours: TourDetails[]) => {
		for(let tour of tours) {
			let stringifyname = tour.company_name;
			if(!companys.includes(stringifyname))
			{
				companys.push(stringifyname);
			}
		}
	};

	const restore = () => {
		selectedTimespan = "Zeitraum";
		selectedCompany = "Unternehmen";
		paginate(data.tours);
		setPage(0);
	};

	let selectedTimespan = $state("Zeitraum");
	let timespans = ["Quartal 1", "Quartal 2", "Quartal 3", "Quartal 4", "Aktuelles Jahr", "Letztes Jahr"];

	const filter = (comp: boolean, time: boolean, selectedCompany: string, selectedTime: string) => {
		let newrows: TourDetails[] = [];
		if(comp) 
		{
			for(let row of data.tours)
			{
				if(row.company_name==selectedCompany) 
				{
					newrows.push(row);
				}
			}
		}
		else if(time) 
		{	
			switch(selectedTime) 
			{
				case "Quartal 1": {
					for(let row of data.tours) {
						if(row.from.getMonth()==0 || row.from.getMonth()==1 || row.from.getMonth()==2) {
							newrows.push(row);
						}
					}
					};
					break;
				case "Quartal 2": {
					for(let row of data.tours) {
						if(row.from.getMonth()==3 || row.from.getMonth()==4 || row.from.getMonth()==5) {	
							newrows.push(row);
						}
					}
					};
					break;
				case "Quartal 3": {
					for(let row of data.tours) {
						if(row.from.getMonth()==6 || row.from.getMonth()==7 || row.from.getMonth()==8) {
							newrows.push(row);
						}
					}
					};
					break;
				case "Quartal 4": {
					for(let row of data.tours) {
						if(row.from.getMonth()==9 || row.from.getMonth()==10 || row.from.getMonth()==11) {
							newrows.push(row);
						}
					}
					};
					break;
				case "Aktuelles Jahr": {
					const currentDate = new Date();
					let year = currentDate.getFullYear();
					for(let row of data.tours) {
						if(row.from.getFullYear()==year) {
								newrows.push(row);
						}
					}
					};
					break;
				case "Letztes Jahr": {
					const currentDate = new Date();
					let year = currentDate.getFullYear() - 1;
					for(let row of data.tours) {
						if(row.from.getFullYear()==year) {
								newrows.push(row);
						}
					}
					};
					break;
				default: newrows = data.tours;
			}
		}
		else {
			newrows = data.tours;
		}
		selectedTimespan = "Zeitraum";
		selectedCompany = "Unternehmen";
		paginate(newrows);
		setPage(0);
	};

</script>

<div class="flex justify-between">
	<Card.Header>
		<Card.Title>Abrechnung</Card.Title>
	</Card.Header>
	
	<div class="font-semibold leading-none tracking-tight p-6 flex gap-4">
		<Button type="submit" on:click={() => restore()} > 
			Filter zurücksetzten
		</Button>
		<Dialog.Root>
			<Dialog.Trigger class={buttonVariants({ variant: "outline" })}> 
				Filteroptionen
			</Dialog.Trigger>
			<Dialog.Content class="sm:max-w-[450px]">
			  <Dialog.Header>
				<Dialog.Title>Filteroptionen</Dialog.Title>
				<Dialog.Description>
				  Filteren Sie die Daten für eine bessere Übersicht.
				</Dialog.Description>
			  </Dialog.Header>
				<div class="grid grid-cols-2 items-center gap-4">
					<Label for="name" class="text-left">Filter nach Unternehmen:</Label>
					<select
					name="company"
					id="company"
					class={cn(buttonVariants({ variant: 'outline' }),
						"max-w-[275px]"
					)}
					bind:value={selectedCompany}
				>
					<option id="company" selected={true} disabled>Unternehmen</option>
					{#each companys as c}
						<option id="company" value={c}>
							{c}
						</option>
					{/each}
				</select>
				</div>
				<div class="grid grid-cols-2 items-center gap-4">
				  <Label for="timespan" class="text-left">Filter nach Zeitraum:</Label>
				  <select
					name="months"
					id="months"
					class={cn(buttonVariants({ variant: 'outline' }),
						"max-w-[275px]"
					)}
					bind:value={selectedTimespan}
				>
					<option id="months" selected={true} disabled>Zeitraum</option>
					{#each timespans as t}
						<option id="months" value={t}>
							{t}
						</option>
					{/each}
				</select>
				</div>
				<div class="grid grid-cols-2 items-center gap-4">
					<!-- TODO: Kalender für custom Timespan -->
					<Label for="timespan" class="text-left">Filter nach beliebigem Zeitraum:</Label>
					<Input id="timespan" value="01.01.2024" class="max-w-[275px]" />
				</div>
			  <Dialog.Close class="text-right">
				<Button type="submit" 
					on:click={() => filter(selectedCompany!="Unternehmen", selectedTimespan!="Zeitraum", selectedCompany, selectedTimespan)}>
					Filter anwenden
				</Button>
			  </Dialog.Close>
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
