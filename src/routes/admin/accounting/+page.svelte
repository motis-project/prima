<script lang="ts">
	import * as Card from '$lib/shadcn/card';
	import * as Table from '$lib/shadcn/table/index';
	import * as Dialog from '$lib/shadcn/dialog/index';
	import { ChevronsUpDown } from 'lucide-svelte';
	import { Button, buttonVariants } from '$lib/shadcn/button';
	import Label from '$lib/shadcn/label/label.svelte';
	import { onMount } from 'svelte';
	import { getLocalTimeZone, today, CalendarDate } from '@internationalized/date';
	import { paginate, setCurrentPages } from '$lib/Paginate';
	import Papa from 'papaparse';
	import pkg from 'file-saver';
	import Paginate from '$lib/paginate.svelte';
	import type { Tour, Tours } from '$lib/server/db/getTours';
	import { FIXED_PRICE } from '$lib/constants.js';
	import Tabs from '$lib/ui/tabs.svelte';

	const { data } = $props();

	const { saveAs } = pkg;

	const thisYear = new Date(Date.now()).getFullYear();

	const getCustomerCount = (tour: Tour) => {
		let customers = new Set<number>();
		tour.events.forEach((e) => {
			customers.add(e.customer!);
		});
		return customers.size;
	};

	const getTourCost = (tour: Tour) => {
		return Math.max(0, (tour.fare ?? 0) - FIXED_PRICE * getCustomerCount(tour));
	};

	const getEuroString = (price: number | null) => {
		return ((price ?? 0) / 100).toFixed(2);
	};

	let currentRowsToursTable: Tour[] = [];
	let currentRowsSubtractionsTable: Tour[] = [];
	let perPage = 5;
	let firstPage = data.tours.slice(0, perPage);
	let firstarray = [firstPage];
	let paginationInfo = $state<{
		page: number;
		currentPageRows: Tour[];
		totalPages: Tour[][];
	}>({ page: 0, currentPageRows: firstPage, totalPages: firstarray });

	onMount(() => {
		currentRowsToursTable = data.tours;
		paginationInfo.totalPages = paginate(perPage, currentRowsToursTable);
		setCompanys(currentRowsToursTable);
	});

	// --- Sort: ---
	let descending = [true, true, true];

	const sortColumn = (idx: number) => {
		switch (idx) {
			case 0: {
				currentRowsToursTable.sort((a, b) => a.startTime - b.startTime);
				break;
			}
			case 1: {
				currentRowsToursTable.sort((a, b) => getTourCost(a) - getTourCost(b));
				break;
			}
			case 2: {
				currentRowsToursTable.sort((a, b) => (a.fare ?? 0) - (b.fare ?? 0));
			}
			default:
				return;
		}
		if (!descending[idx]) {
			currentRowsToursTable.reverse();
		} else {
			for (let i = 0; i < descending.length; i++) {
				if (i != idx) descending[i] = true;
			}
		}
		descending[idx] = !descending[idx];
		paginationInfo.totalPages = paginate(perPage, currentRowsToursTable);
		paginationInfo.page = 0;
		paginationInfo.currentPageRows = setCurrentPages(
			paginationInfo.page,
			paginationInfo.totalPages
		);
	};

	// --- Filter: ---
	let start = today(getLocalTimeZone());
	let end = start.add({ days: 7 });
	let range = $state({ start, end });
	let selectedCompany = $state('Unternehmen');
	let companys = $state([data.tours.at(0)?.companyName]);
	const setCompanys = (tours: Tour[]) => {
		for (let tour of tours) {
			let stringifyname = tour.companyName;
			if (!companys.includes(stringifyname)) {
				companys.push(stringifyname);
			}
		}
	};

	let selectedTimespan = $state('Zeitraum');
	let selectedYear = $state('Jahr');
	let timespans = [
		'Quartal 1',
		'Quartal 2',
		'Quartal 3',
		'Quartal 4',
		'ganzes Jahr'
	];

	const filter = () => {
		const getNewRows = () => {
			const isMonthOk = (time: string, month: number) => {
				let result = false;
				switch (time) {
					case 'Quartal 1':
						result = month == 0 || month == 1 || month == 2;
						break;
					case 'Quartal 2':
						result = month == 3 || month == 4 || month == 5;
						break;
					case 'Quartal 3':
						result = month == 6 || month == 7 || month == 8;
						break;
					case 'Quartal 4':
						result = month == 9 || month == 10 || month == 11;
						break;
					default:
						result = true;
				}
				return result;
			};

			const comp = selectedCompany != 'Unternehmen';
			const time = selectedTimespan != 'Zeitraum';
			const span = range.end == end && range.start == start ? false : true;
			let newrows: Tour[] = [];
			const currentDate = new Date();
			let year = currentDate.getFullYear();
			const targetYear = selectedTimespan === 'Letztes Jahr' ? year - 1 : year;
			for (let row of data.tours) {
				if (time && timespans.find((str) => str === selectedTimespan) == undefined) {
					newrows = data.tours;
					break;
				}
				const d = new Date(row.startTime);
				let rowDate: CalendarDate = new CalendarDate(
					d.getFullYear(),
					d.getMonth() + 1,
					d.getDate()
				);
				if (
					(time &&
						new Date(row.startTime).getFullYear() == targetYear &&
						isMonthOk(selectedTimespan, new Date(row.startTime).getMonth())) ||
					(span && rowDate.compare(range.start) >= 0 && rowDate.compare(range.end) <= 0) ||
					(comp && !span && !time)
				) {
					if (!comp || (comp && row.companyName == selectedCompany)) {
						newrows.push(row);
					}
				}
			}
			if (!span && !comp && !time) {
				newrows = data.tours;
			}
			return newrows;
		}

		currentRowsToursTable = getNewRows();
		restore();
	};

	const restore = () => {
		selectedTimespan = 'Zeitraum';
		selectedCompany = 'Unternehmen';
		prepareFilterString();
		start = today(getLocalTimeZone());
		end = start.add({ days: 7 });
		range = { start, end };
		currentRowsToursTable = data.tours;
		paginationInfo.totalPages = paginate(perPage, currentRowsToursTable);
		paginationInfo.page = 0;
		paginationInfo.currentPageRows = setCurrentPages(
			paginationInfo.page,
			paginationInfo.totalPages
		);
	};

	let filterString = $state('keine Filter ausgewählt');
	let sum = $state(0);

	const prepareFilterString = () => {
		let result = ' ';
		if (selectedCompany != 'Unternehmen') {
			result = result.concat(selectedCompany, '; ');
		}
		if (selectedTimespan != 'Zeitraum') {
			result = result.concat(selectedTimespan, '; ');
		}
		if (range.end != end && range.start != start) {
			result = result.concat(range.start.toString(), ' - ', range.end.toString());
		}
		if (
			selectedCompany == 'Unternehmen' &&
			selectedTimespan == 'Zeitraum' &&
			range.end == end &&
			range.start == start
		) {
			result = 'keine Filter ausgewählt';
		}
		filterString = result;
	};

	const summarize = (currentRows: Tours) => {
		sum = 0;
		let toIterate = data.tours;
		if (filterString != 'keine Filter ausgewählt') {
			toIterate = currentRows;
		}
		for (let row of toIterate) {
			sum += getTourCost(row);
		}
	};

	const csvExport = (currentTourData: Tour[], filename: string) => {
		currentTourData.sort((a, b) => a.startTime - b.startTime);
		let thisDay = new Date();
		let oneDayTours: Tour[] = [];
		let daySum = 0;
		let data = [];
		let isFirst = true;
		data.push(['Unternehmen', 'Tag', 'Taxameterpreis', 'ÖV-Preis', 'Gesamtpreis', 'Kosten']);
		for (let row of currentTourData) {
			if (isFirst) {
				thisDay = new Date(row.startTime);
				isFirst = false;
			}
			if (thisDay.getTime() !== row.startTime) {
				daySum = 0//computeDayCost(oneDayTours, thisDay);
				data.push([
					'Summe Tag',
					thisDay.toLocaleString('de-DE').slice(0, -10),
					'',
					'',
					'',
					getEuroString(daySum)
				]);
				thisDay = new Date(row.startTime);
				daySum = 0;
				oneDayTours.length = 0;
			}
			data.push([
				row.companyName,
				new Date(row.startTime).toLocaleString('de-DE').slice(0, -10),
				getEuroString(row.fare),
				getEuroString(getTourCost(row))
			]);
			oneDayTours.push(row);
		}
		// last "oneDayTours"
		daySum = 0//computeDayCost(oneDayTours, thisDay);
		data.push([
			'Summe Tag',
			thisDay.toLocaleString('de-DE').slice(0, -10),
			'',
			'',
			'',
			getEuroString(daySum)
		]);
		data.push(['Summe insgesamt', '', '', '', '', getEuroString(sum)]);
		const csvContent = Papa.unparse(data, { header: true });
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		saveAs(blob, filename);
	};

	let items = [
    { label: "pro Tour",
		 value: 1,
		 component: tourTable
		},
    { label: "pro Tag",
		 value: 2,
		 component: subtractionTable
		}
  ];
</script>

{#snippet tourTable()}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head class="mt-6.5">Unternehmen</Table.Head>
				<Table.Head class="mt-6.5">
					<Button class="whitespace-pre" variant="outline" onclick={() => sortColumn(0)}>
						{'Abfahrt  '}
						<ChevronsUpDown class="h-6 w-4" />
					</Button>
				</Table.Head>
				<Table.Head class="mt-6.5">Ankunft</Table.Head>
				<Table.Head class="mt-6.5 text-center">Anzahl Kunden</Table.Head>
				<Table.Head class="mt-6.5 text-center">
					<Button class="whitespace-pre" variant="outline" onclick={() => sortColumn(1)}>
						{'Taxameterpreis  '}
						<ChevronsUpDown class="h-6 w-4" />
					</Button>
				</Table.Head>
				<Table.Head class="mt-6.5 text-center">
					<Button class="whitespace-pre" variant="outline" onclick={() => sortColumn(2)}>
						{'Kosten  '}
						<ChevronsUpDown class="h-6 w-4" />
					</Button>
				</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each paginationInfo.currentPageRows as tour}
				<Table.Row>
					<Table.Cell>{tour.companyName}</Table.Cell>
					<Table.Cell>{new Date(tour.startTime).toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
					<Table.Cell>{new Date(tour.endTime).toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
					<Table.Cell class="text-center">{getCustomerCount(tour)}</Table.Cell>
					<Table.Cell class="text-center">{getEuroString(tour.fare)} €</Table.Cell>
					<Table.Cell class="text-center">{getEuroString(getTourCost(tour))} €</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{/snippet}

{#snippet subtractionTable()}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head class="mt-6.5">Unternehmen</Table.Head>
				<Table.Head class="mt-6.5">Tag</Table.Head>
				<Table.Head class="mt-6.5 text-center">
					<Button class="whitespace-pre" variant="outline" onclick={() => sortColumn(1)}>
						{'Taxameterpreis kumuliert '}
						<ChevronsUpDown class="h-6 w-4" />
					</Button>
				</Table.Head>
				<Table.Head class="mt-6.5 text-center">
					<Button class="whitespace-pre" variant="outline" onclick={() => sortColumn(2)}>
						{'Abzüge  '}
						<ChevronsUpDown class="h-6 w-4" />
					</Button>
				</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each paginationInfo.currentPageRows as tour}
				<Table.Row>
					<Table.Cell>{tour.companyName}</Table.Cell>
					<Table.Cell>tac</Table.Cell>
					<Table.Cell class="text-center">{getEuroString(tour.fare)} €</Table.Cell>
					<Table.Cell class="text-center">{getEuroString(getTourCost(tour))} €</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{/snippet}

<div>
	<Card.Header>
		<Card.Title>Abrechnung</Card.Title>
	</Card.Header>
	<div class="flex gap-4 p-6 font-semibold leading-none tracking-tight">
		<Button type="submit" onclick={() => restore()}>Filter zurücksetzten</Button>
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
						class={buttonVariants({ variant: 'outline' })}
						bind:value={selectedCompany}
					>
						<option selected={true} disabled>Unternehmen</option>
						{#each companys as c}
							<option value={c}>
								{c}
							</option>
						{/each}
					</select>
				</div>
				<div class="grid grid-cols-2 items-center gap-4">
					<Label for="timespan" class="text-left">Filter nach Zeitraum:</Label>
					<select
						class={buttonVariants({ variant: 'outline' })}
						bind:value={selectedTimespan}
					>
						<option selected={true} disabled>Zeitraum</option>
						{#each timespans as t}
							<option value={t}>
								{t}
							</option>
						{/each}
					</select>
					<Label for="timespan" class="text-left">Filter nach Jahr:</Label>
					<select
						class={buttonVariants({ variant: 'outline' })}
						bind:value={selectedYear}
					>
						<option selected={true} disabled>Jahr</option>
						<option value={thisYear}>{thisYear.toString()}</option>
						<option value={thisYear-1}>{(thisYear-1).toString()}</option>
					</select>
				</div>
				<Dialog.Close class="text-right">
					<Button
						type="submit"
						onclick={filter}
					>
						Filter anwenden
					</Button>
				</Dialog.Close>
			</Dialog.Content>
		</Dialog.Root>

		<Dialog.Root>
			<Dialog.Trigger
				class={buttonVariants({ variant: 'outline' })}
				onclick={() => summarize(currentRowsToursTable)}
			>
				Summierung Kosten
			</Dialog.Trigger>
			<Dialog.Content class="sm:max-w-[850px]">
				<Dialog.Header>
					<Dialog.Title>Summierung Kosten</Dialog.Title>
					<Dialog.Description>
						Summiere Kosten, um eine Abrechnungsdatei zu erstellen.
					</Dialog.Description>
				</Dialog.Header>
				<Label for="name" class="text-left">
					Folgende Filter sind ausgewählt: {filterString}
				</Label>
				<Table.Root>
					<Table.Header>
							<Table.Head class="mt-6.5">Unternehmen</Table.Head>
							<Table.Head class="mt-6.5">Tag</Table.Head>
							<Table.Head class="mt-6.5 text-center">Taxameterpreis</Table.Head>
							<Table.Head class="mt-6.5 text-center">Gesamtpreis</Table.Head>
							<Table.Head class="mt-6.5 text-center">Kosten</Table.Head>
					</Table.Header>
					<Table.Body>
						{#each paginationInfo.currentPageRows as tour}
							<Table.Row>
								<Table.Cell>{tour.companyName}</Table.Cell>
								<Table.Cell
									>{new Date(tour.startTime.toLocaleString('de-DE').slice(0, -10))}</Table.Cell
								>
								<Table.Cell class="text-center">{getEuroString(tour.fare)} €</Table.Cell>
								<Table.Cell class="text-center">{getEuroString(getTourCost(tour))} €</Table.Cell>
							</Table.Row>
						{/each}
						{#if paginationInfo.totalPages.length > 1}
							<Table.Row>
								<Table.Cell>...</Table.Cell>
								<Table.Cell class="text-center">...</Table.Cell>
								<Table.Cell class="text-center">...</Table.Cell>
								<Table.Cell class="text-center">...</Table.Cell>
								<Table.Cell class="text-center">...</Table.Cell>
								<Table.Cell class="text-center">...</Table.Cell>
							</Table.Row>
						{/if}
						<Table.Row>
							<Table.Cell>Summe insgesamt</Table.Cell>
							<Table.Cell></Table.Cell>
							<Table.Cell></Table.Cell>
							<Table.Cell></Table.Cell>
							<Table.Cell></Table.Cell>
							<Table.Cell>{getEuroString(sum)} €</Table.Cell>
						</Table.Row>
					</Table.Body>
				</Table.Root>
				<Dialog.Close class="text-right">
					<Button type="submit" onclick={() => csvExport(currentRowsToursTable, 'Abrechnung')}>
						CSV-Export starten
					</Button>
				</Dialog.Close>
			</Dialog.Content>
		</Dialog.Root>
	</div>
	<Card.Content class="h-full w-full">
		<Tabs {items} />
		<Paginate bind:open={paginationInfo} />
	</Card.Content>

</div>
