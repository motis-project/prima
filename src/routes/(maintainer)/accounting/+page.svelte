<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { type TourDetails } from '$lib/TourDetails.js';
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';
	import ChevronRight from 'lucide-svelte/icons/chevron-right';
	import { ChevronsRight, ChevronsLeft } from 'lucide-svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import Label from '$lib/components/ui/label/label.svelte';
	import { onMount } from 'svelte';
	import { getLocalTimeZone, today } from '@internationalized/date';
	import { RangeCalendar } from '$lib/components/ui/range-calendar/index.js';

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
		if (fare == null || fare_route == null) {
			return 0;
		}
		return (Math.round(fare + fare_route) / 100).toFixed(2);
	};

	const getCost = (fare: number | null, fare_route: number | null) => {
		if (fare == null || fare_route == null) {
			return 0;
		}
		return (Math.round((fare_route - fare) * 0.97) / 100).toFixed(2);
	};

	const getPrice = (price: number | null) => {
		if (price == null) {
			return 0;
		}
		return (price / 100).toFixed(2);
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
	//const sort = (des: boolean) => {
	//	console.log('Sort Erreicht');
	//};

	// --- Filter: ---
	let start = today(getLocalTimeZone());
	let end = start.add({ days: 7 });
	let range = $state({ start, end });
	let selectedCompany = $state('Unternehmen');
	let companys = $state([data.tours.at(0)?.company_name]);
	const setCompanys = (tours: TourDetails[]) => {
		for (let tour of tours) {
			let stringifyname = tour.company_name;
			if (!companys.includes(stringifyname)) {
				companys.push(stringifyname);
			}
		}
	};

	const restore = () => {
		selectedTimespan = 'Zeitraum';
		selectedCompany = 'Unternehmen';
		start = today(getLocalTimeZone());
		end = start.add({ days: 7 });
		range = { start, end };
		paginate(data.tours);
		setPage(0);
	};

	let selectedTimespan = $state('Zeitraum');
	let timespans = [
		'Quartal 1',
		'Quartal 2',
		'Quartal 3',
		'Quartal 4',
		'Aktuelles Jahr',
		'Letztes Jahr'
	];

	const filter = (
		comp: boolean,
		time: boolean,
		span: boolean,
		selectedCompany: string,
		selectedTime: string
	) => {
		let newrows: TourDetails[] = [];
		const currentDate = new Date();
		let year = currentDate.getFullYear();
		if (span) {
			for (let row of data.tours) {
				if (
					row.from.getFullYear() == range.start.year ||
					row.from.getFullYear() == range.end.year
				) {
					if (
						row.from.getMonth() == range.start.month - 1 ||
						row.from.getMonth() == range.end.month - 1
					) {
						let onemonth = range.start.month == range.end.month;
						if (
							(row.from.getDate() >= range.start.day &&
								row.from.getDate() <= range.end.day &&
								onemonth) ||
							((row.from.getDate() >= range.start.day || row.from.getDate() <= range.end.day) &&
								!onemonth)
						) {
							newrows.push(row);
						}
					}
				}
			}
		}
		if (comp) {
			for (let row of data.tours) {
				if (row.company_name == selectedCompany) {
					newrows.push(row);
				}
			}
		}
		if (time) {
			switch (selectedTime) {
				case 'Quartal 1':
					{
						for (let row of data.tours) {
							if (row.from.getFullYear() == year) {
								if (
									row.from.getMonth() == 0 ||
									row.from.getMonth() == 1 ||
									row.from.getMonth() == 2
								) {
									newrows.push(row);
								}
							}
						}
					}
					break;
				case 'Quartal 2':
					{
						for (let row of data.tours) {
							if (row.from.getFullYear() == year) {
								if (
									row.from.getMonth() == 3 ||
									row.from.getMonth() == 4 ||
									row.from.getMonth() == 5
								) {
									newrows.push(row);
								}
							}
						}
					}
					break;
				case 'Quartal 3':
					{
						for (let row of data.tours) {
							if (row.from.getFullYear() == year) {
								if (
									row.from.getMonth() == 6 ||
									row.from.getMonth() == 7 ||
									row.from.getMonth() == 8
								) {
									newrows.push(row);
								}
							}
						}
					}
					break;
				case 'Quartal 4':
					{
						for (let row of data.tours) {
							if (row.from.getFullYear() == year) {
								if (
									row.from.getMonth() == 9 ||
									row.from.getMonth() == 10 ||
									row.from.getMonth() == 11
								) {
									newrows.push(row);
								}
							}
						}
					}
					break;
				case 'Aktuelles Jahr':
					{
						for (let row of data.tours) {
							if (row.from.getFullYear() == year) {
								newrows.push(row);
							}
						}
					}
					break;
				case 'Letztes Jahr':
					{
						for (let row of data.tours) {
							if (row.from.getFullYear() == year - 1) {
								newrows.push(row);
							}
						}
					}
					break;
				default:
					newrows = data.tours;
			}
		}
		if (span == false && comp == false && time == false) {
			newrows = data.tours;
		}
		selectedTimespan = 'Zeitraum';
		selectedCompany = 'Unternehmen';
		start = today(getLocalTimeZone());
		end = start.add({ days: 7 });
		range = { start, end };
		paginate(newrows);
		setPage(0);
	};
</script>

<div class="flex justify-between">
	<Card.Header>
		<Card.Title>Abrechnung</Card.Title>
	</Card.Header>

	<div class="font-semibold leading-none tracking-tight p-6 flex gap-4">
		<Button type="submit" on:click={() => restore()}>Filter zurücksetzten</Button>
		<Dialog.Root>
			<Dialog.Trigger class={buttonVariants({ variant: 'outline' })}>Filteroptionen</Dialog.Trigger>
			<Dialog.Content class="sm:max-w-[600px]">
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
						class={cn(buttonVariants({ variant: 'outline' }), 'max-w-[275px]')}
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
						class={cn(buttonVariants({ variant: 'outline' }), 'max-w-[275px]')}
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
				<div class="grid grid-cols-2 items-start gap-4">
					<Label for="timespan" class="text-left">Filter nach beliebigem Zeitraum:</Label>
					<RangeCalendar bind:value={range} />
				</div>
				<Dialog.Close class="text-right">
					<Button
						type="submit"
						on:click={() =>
							filter(
								selectedCompany != 'Unternehmen',
								selectedTimespan != 'Zeitraum',
								range.end == end && range.start == start ? false : true,
								selectedCompany,
								selectedTimespan
							)}
					>
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
					<!--<ChevronsUpDown class="mx-2 size-5" on:click={() => sort(true)}></ChevronsUpDown>-->
				</Table.Head>
				<Table.Head class="mt-6.5">Ankunft</Table.Head>
				<Table.Head class="mt-6.5">Anzahl Kunden</Table.Head>
				<Table.Head class="mt-6.5">Taxameterpreis</Table.Head>
				<Table.Head class="mt-6.5">ÖV-Preis</Table.Head>
				<Table.Head class="mt-6.5">Gesamtpreis</Table.Head>
				<Table.Head class="mt-6.5">Kosten</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each currentPageRows as tour}
				<Table.Row>
					<Table.Cell>{tour.company_name}</Table.Cell>
					<Table.Cell>{tour.from.toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
					<Table.Cell>{tour.to.toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
					<Table.Cell>{getCustomerCount(tour)}</Table.Cell>
					<Table.Cell>{getPrice(tour.fare_route)} €</Table.Cell>
					<Table.Cell>{getPrice(tour.fare)} €</Table.Cell>
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
		<Button variant="outline" on:click={() => setPage(totalPages.length - 1)}>
			Letzte Seite
			<ChevronsRight class="mx-1 h-4 w-4" />
		</Button>
	{:else}
		<Button variant="outline" on:click={() => setPage(page - 1)}>
			<ChevronLeft class="h-4 w-4" />
			Vorherige Seite
		</Button>
		{#each totalPages as _page, i}
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
		Auf Seite {page + 1} von {totalPages.length}
	</Label>
</div>
