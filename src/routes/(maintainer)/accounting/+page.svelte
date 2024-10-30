<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { type TourDetails } from '$lib/TourDetails.js';
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';
	import ChevronRight from 'lucide-svelte/icons/chevron-right';
	import { ChevronsRight, ChevronsLeft, ChevronsUpDown } from 'lucide-svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import Label from '$lib/components/ui/label/label.svelte';
	import { onMount } from 'svelte';
	import { getLocalTimeZone, today, CalendarDate } from '@internationalized/date';
	import { RangeCalendar } from '$lib/components/ui/range-calendar/index.js';
	import Papa from 'papaparse';
	import { saveAs } from 'file-saver';

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
		return fare + getCost(fare, fare_route);
	};

	const getCost = (fare: number | null, fare_route: number | null) => {
		if (fare == null || fare_route == null) {
			return 0;
		}
		let diff = Math.max(0, (fare_route - fare));
		if (diff > 0) {
			return Math.round((fare_route - fare) * 0.97);
		}
		return 0;
	};

	const getEuroString = (price: number | null) => {
		if (price == null) {
			return "0.00";
		}
		return (price / 100).toFixed(2);
	};

	let currentRows: TourDetails[] = [];
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
		currentRows = data.tours;
		paginate(currentRows);
		setCompanys(currentRows);
	});

	const setPage = (p: number) => {
		if (p >= 0 && p < totalPages.length) {
			page = p;
		}
		currentPageRows = totalPages.length > 0 ? totalPages[page] : [];
	};

	// --- Sort: ---
	let descending = [true, true, true, true];

	// -1 => a before b
	//  1 => a after b
	//  0 => equal

	const compareDate = (a: TourDetails, b: TourDetails) => {
		if (a.from.getFullYear() < b.from.getFullYear()) return -1;
		if (a.from.getFullYear() > b.from.getFullYear()) return 1;
		if (a.from.getMonth() < b.from.getMonth()) return -1;
		if (a.from.getMonth() > b.from.getMonth()) return 1;
		if (a.from.getDate() < b.from.getDate()) return -1;
		if (a.from.getDate() > b.from.getDate()) return 1;
		return 0;
	};

	const compareFareRoute = (a: TourDetails, b: TourDetails) => {
		if (a.fare_route == null && b.fare_route == null) return 0;
		if (a.fare_route == null) return 1;
		if (b.fare_route == null) return -1;
		if (a.fare_route != null && b.fare_route != null && a.fare_route < b.fare_route) return -1;
		if (a.fare_route != null && b.fare_route != null && a.fare_route > b.fare_route) return 1;
		return 0;
	};

	const compareTotalPrice = (a: TourDetails, b: TourDetails) => {
		let aTotal = getTotalPrice(a.fare, a.fare_route);
		let bTotal = getTotalPrice(b.fare, b.fare_route);
		if (+aTotal < +bTotal) return -1;
		if (+aTotal > +bTotal) return 1;
		return 0;
	};

	const compareCost = (a: TourDetails, b: TourDetails) => {
		let aCost = getCost(a.fare, a.fare_route);
		let bCost = getCost(b.fare, b.fare_route);
		if (+aCost < +bCost) return -1;
		if (+aCost > +bCost) return 1;
		return 0;
	};

	const sort = (des: boolean[], idx: number) => {
		if (des[idx]) {
			switch (idx) {
				case 0: {
					currentRows.sort(compareDate);
					paginate(currentRows);
					setPage(0);
					descending[0] = false;
					// all others reset
					descending[1] = true;
					descending[2] = true;
					descending[3] = true;
					break;
				}
				case 1: {
					currentRows.sort(compareFareRoute);
					paginate(currentRows);
					setPage(0);
					descending[1] = false;
					// all others reset
					descending[0] = true;
					descending[2] = true;
					descending[3] = true;
					break;
				}
				case 2: {
					currentRows.sort(compareTotalPrice);
					paginate(currentRows);
					setPage(0);
					descending[2] = false;
					// all others reset
					descending[0] = true;
					descending[1] = true;
					descending[3] = true;
					break;
				}
				case 3: {
					currentRows.sort(compareCost);
					paginate(currentRows);
					setPage(0);
					descending[3] = false;
					// all others reset
					descending[0] = true;
					descending[1] = true;
					descending[2] = true;
					break;
				}
				default:
					return;
			}
		} else {
			switch (idx) {
				case 0: {
					currentRows.sort(compareDate);
					currentRows.reverse();
					paginate(currentRows);
					setPage(0);
					descending[0] = true;
					break;
				}
				case 1: {
					currentRows.sort(compareFareRoute);
					currentRows.reverse();
					paginate(currentRows);
					setPage(0);
					descending[1] = true;
					break;
				}
				case 2: {
					currentRows.sort(compareTotalPrice);
					currentRows.reverse();
					paginate(currentRows);
					setPage(0);
					descending[2] = true;
					break;
				}
				case 3: {
					currentRows.sort(compareCost);
					currentRows.reverse();
					paginate(currentRows);
					setPage(0);
					descending[3] = true;
					break;
				}
				default:
					return;
			}
		}
	};

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
		prepareFilterString();
		start = today(getLocalTimeZone());
		end = start.add({ days: 7 });
		range = { start, end };
		currentRows = data.tours;
		paginate(currentRows);
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
		if (comp && span == false && time == false) {
			for (let row of data.tours) {
				if (row.company_name == selectedCompany) {
					newrows.push(row);
				}
			}
		}
		if (span) {
			for (let row of data.tours) {
				let rowDate = new CalendarDate(
					row.from.getFullYear(),
					row.from.getMonth() + 1,
					row.from.getDate()
				);
				if (rowDate.compare(range.start) >= 0 && rowDate.compare(range.end) <= 0) {
					if (comp) {
						if (row.company_name == selectedCompany) {
							newrows.push(row);
						}
					} else {
						newrows.push(row);
					}
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
									if (comp) {
										if (row.company_name == selectedCompany) {
											newrows.push(row);
										}
									} else {
										newrows.push(row);
									}
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
									if (comp) {
										if (row.company_name == selectedCompany) {
											newrows.push(row);
										}
									} else {
										newrows.push(row);
									}
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
									if (comp) {
										if (row.company_name == selectedCompany) {
											newrows.push(row);
										}
									} else {
										newrows.push(row);
									}
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
									if (comp) {
										if (row.company_name == selectedCompany) {
											newrows.push(row);
										}
									} else {
										newrows.push(row);
									}
								}
							}
						}
					}
					break;
				case 'Aktuelles Jahr':
					{
						for (let row of data.tours) {
							if (row.from.getFullYear() == year) {
								if (comp) {
									if (row.company_name == selectedCompany) {
										newrows.push(row);
									}
								} else {
									newrows.push(row);
								}
							}
						}
					}
					break;
				case 'Letztes Jahr':
					{
						for (let row of data.tours) {
							if (row.from.getFullYear() == year - 1) {
								if (comp) {
									if (row.company_name == selectedCompany) {
										newrows.push(row);
									}
								} else {
									newrows.push(row);
								}
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
		prepareFilterString();
		selectedTimespan = 'Zeitraum';
		selectedCompany = 'Unternehmen';
		start = today(getLocalTimeZone());
		end = start.add({ days: 7 });
		range = { start, end };
		currentRows = newrows;
		paginate(currentRows);
		setPage(0);
	};
	
	// --- Summierung: ---
	let filterString = $state("keine Filter ausgewählt");
	let sum = $state(0);
	
	const prepareFilterString = () => {
		let result = " ";
		if (selectedCompany != "Unternehmen") {
			result = result.concat(selectedCompany, "; ");
		}
		if (selectedTimespan != "Zeitraum") {
			result = result.concat(selectedTimespan, "; ");
		}
		if(range.end != end && range.start != start) {
			result = result.concat(range.start.toString(), " - ", range.end.toString());
		}
		if (selectedCompany == "Unternehmen" && selectedTimespan == "Zeitraum" && range.end == end && range.start == start) {
			result = "keine Filter ausgewählt"
		}
		filterString = result;
	};

	const summarize = (currentPageRows: TourDetails[]) => {
		sum = 0;
		let toIterate = data.tours;
		if (filterString != "keine Filter ausgewählt") {
			toIterate = currentPageRows;
		}
		for(let row of toIterate) {
			sum += getCost(row.fare, row.fare_route);
		};
	};

	// TODO:
	// Data soll nur das sein, was von current page rows angezeigt wird. Am besten ein eigenes string array bauen.
	// Download funktioniert, daten sind noch nicht die die es sein sollen.
	// Schauen wie es im excel aussieht und schauen wie es in notepad aussieht sozusagen. 
	// Bei Papaparse website nach den Konfigurationsmöglichkeiten schauen.
	const csvExport = (data: TourDetails[], filename: string) => {
		const csvContent = Papa.unparse(data);
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		saveAs(blob, filename);
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

		<Dialog.Root>
			<Dialog.Trigger 
				class={buttonVariants({ variant: 'outline' })} 
				on:click={() => summarize(currentPageRows)}>
				Summierung Kosten
			</Dialog.Trigger>
			<Dialog.Content class="sm:max-w-[850px]">
				<Dialog.Header>
					<Dialog.Title>Summierung Kosten</Dialog.Title>
					<Dialog.Description>
						Summieren Sie die Kosten, um eine Abrechnungsdatei zu erstellen.
					</Dialog.Description>
				</Dialog.Header>
					<Label for="name" class="text-left">
						Folgende Filter sind ausgewählt: {filterString}
					</Label>
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head class="mt-6.5">Unternehmen</Table.Head>
							<Table.Head class="mt-6.5">Abfahrt</Table.Head>
							<Table.Head class="mt-6.5">Ankunft</Table.Head>
							<Table.Head class="mt-6.5 text-center">Anzahl Kunden</Table.Head>
							<Table.Head class="mt-6.5 text-center">Taxameterpreis </Table.Head>
							<Table.Head class="mt-6.5 text-center">ÖV-Preis</Table.Head>
							<Table.Head class="mt-6.5 text-center">Gesamtpreis</Table.Head>
							<Table.Head class="mt-6.5 text-center">Kosten</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each currentPageRows as tour}
							<Table.Row>
								<Table.Cell>{tour.company_name}</Table.Cell>
								<Table.Cell>{tour.from.toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
								<Table.Cell>{tour.to.toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
								<Table.Cell class="text-center">{getCustomerCount(tour)}</Table.Cell>
								<Table.Cell class="text-center">{getEuroString(tour.fare_route)} €</Table.Cell>
								<Table.Cell class="text-center">{getEuroString(tour.fare)} €</Table.Cell>
								<Table.Cell class="text-center">{getEuroString(getTotalPrice(tour.fare, tour.fare_route))} €</Table.Cell>
								<Table.Cell class="text-center">{getEuroString(getCost(tour.fare, tour.fare_route))} €</Table.Cell>
							</Table.Row>
						{/each}
						<Table.Row>
							<Table.Cell>Summe</Table.Cell>
							<Table.Cell></Table.Cell>
							<Table.Cell></Table.Cell>
							<Table.Cell></Table.Cell>
							<Table.Cell></Table.Cell>
							<Table.Cell></Table.Cell>
							<Table.Cell></Table.Cell>
							<Table.Cell>{getEuroString(sum)} €</Table.Cell>
						</Table.Row>
					</Table.Body>
				</Table.Root>
				<Dialog.Close class="text-right">
					<Button
						type="submit"
						on:click={() => csvExport(currentPageRows, "Abrechnung")}>
						CSV-Export starten
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
				<Table.Head class="mt-6.5">
					<Button class="whitespace-pre" variant="outline" on:click={() => sort(descending, 0)}>
						{'Abfahrt  '}
						<ChevronsUpDown class="h-6 w-4" />
					</Button>
				</Table.Head>
				<Table.Head class="mt-6.5">Ankunft</Table.Head>
				<Table.Head class="mt-6.5 text-center">Anzahl Kunden</Table.Head>
				<Table.Head class="mt-6.5 text-center">
					<Button class="whitespace-pre" variant="outline" on:click={() => sort(descending, 1)}>
						{'Taxameterpreis  '}
						<ChevronsUpDown class="h-6 w-4" />
					</Button>
				</Table.Head>
				<Table.Head class="mt-6.5 text-center">ÖV-Preis</Table.Head>
				<Table.Head class="mt-6.5 text-center">
					<Button class="whitespace-pre" variant="outline" on:click={() => sort(descending, 2)}>
						{'Gesamtpreis  '}
						<ChevronsUpDown class="h-6 w-4" />
					</Button>
				</Table.Head>
				<Table.Head class="mt-6.5 text-center">
					<Button class="whitespace-pre" variant="outline" on:click={() => sort(descending, 3)}>
						{'Kosten  '}
						<ChevronsUpDown class="h-6 w-4" />
					</Button>
				</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each currentPageRows as tour}
				<Table.Row>
					<Table.Cell>{tour.company_name}</Table.Cell>
					<Table.Cell>{tour.from.toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
					<Table.Cell>{tour.to.toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
					<Table.Cell class="text-center">{getCustomerCount(tour)}</Table.Cell>
					<Table.Cell class="text-center">{getEuroString(tour.fare_route)} €</Table.Cell>
					<Table.Cell class="text-center">{getEuroString(tour.fare)} €</Table.Cell>
					<Table.Cell class="text-center">{getEuroString(getTotalPrice(tour.fare, tour.fare_route))} €</Table.Cell>
					<Table.Cell class="text-center">{getEuroString(getCost(tour.fare, tour.fare_route))} €</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

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

</Card.Content>