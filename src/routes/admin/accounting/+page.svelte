<script lang="ts">
	import * as Card from '$lib/shadcn/card';
	import * as Table from '$lib/shadcn/table/index';
	import * as Dialog from '$lib/shadcn/dialog/index';
	import { ChevronsUpDown } from 'lucide-svelte';
	import { Button, buttonVariants } from '$lib/shadcn/button';
	import Label from '$lib/shadcn/label/label.svelte';
	import { onMount } from 'svelte';
	import Papa from 'papaparse';
	import pkg from 'file-saver';
	import type { Tour } from '$lib/server/db/getTours';
	import { FIXED_PRICE } from '$lib/constants.js';
	import Tabs from '$lib/ui/tabs.svelte';
	import { DAY, HOUR, MINUTE, SECOND } from '$lib/util/time.js';

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

	const displayDuration = (duration: number) => {
		const rounded = Math.floor(duration / HOUR);
		const minutes = ((duration / HOUR - rounded) * MINUTE) / SECOND;
		return (rounded < 10 ? '0' : '') + rounded + ':' + (minutes < 10 ? '0' : '') + minutes;
	};

	type Subtractions = {
		taxameter: number;
		companyId: number;
		companyName: string | null;
		capped: number;
		uncapped: number;
		day: number;
		availabilityDuration: number;
		customerCount: number;
	};

	let currentRowsToursTable: Tour[] = $state([]);
	let currentRowsSubtractionsTable: Subtractions[] = $state([]);

	onMount(() => {
		currentRowsToursTable = data.tours;
		currentRowsSubtractionsTable = data.companyCostsPerDay;
		setCompanys(currentRowsToursTable);
	});

	$effect(() => {
		sum = getNewSum(currentRowsSubtractionsTable);
	});

	// --- Sort: ---
	let descendingTours = [true, true, true];
	let descendingSubtractions = [true, true, true, true, true, true];

	const sortTourColumn = (idx: number) => {
		switch (idx) {
			case 0: {
				currentRowsToursTable.sort((a, b) => a.startTime - b.startTime);
				break;
			}
			case 1: {
				currentRowsToursTable.sort((a, b) => (a.fare ?? 0) - (b.fare ?? 0));
				break;
			}
			case 2: {
				currentRowsToursTable.sort((a, b) => getTourCost(a) - getTourCost(b));
				break;
			}
			default:
				return;
		}
		if (!descendingTours[idx]) {
			currentRowsToursTable.reverse();
		} else {
			for (let i = 0; i < descendingTours.length; i++) {
				if (i != idx) descendingTours[i] = true;
			}
		}
		descendingTours[idx] = !descendingTours[idx];
	};

	const sortSubtractionColumn = (idx: number, sortFn: (a: Subtractions, b: Subtractions) => number) => {
		currentRowsSubtractionsTable.sort(sortFn);
		if (!descendingSubtractions[idx]) {
			currentRowsSubtractionsTable.reverse();
		} else {
			for (let i = 0; i < descendingSubtractions.length; i++) {
				if (i != idx) descendingSubtractions[i] = true;
			}
		}
		descendingSubtractions[idx] = !descendingSubtractions[idx];
	};

	// --- Filter: ---
	let selectedCompany = $state({ name: 'Unternehmen', id: -1 });
	let companys = $state(new Array<{ name: string | null; id: number }>());
	const setCompanys = (tours: Tour[]) => {
		for (let tour of tours) {
			if (companys.find((c) => c.id == tour.companyId) === undefined) {
				companys.push({ name: tour.companyName, id: tour.companyId });
			}
		}
	};

	const dayIdxToString = (day: number) => {
		return new Date(data.firstOfJanuaryLastYear + 24 * HOUR * day).toLocaleDateString();
	};

	let months = [
		'Janurar',
		'Februar',
		'März',
		'April',
		'Mai',
		'Juni',
		'Juli',
		'August',
		'September',
		'Oktober',
		'November',
		'Dezember'
	];
	let selectedYear = $state(-1);
	let selectedMonth = $state('Monat');
	const selectedMonthIdx = $derived(months.findIndex((m) => m === selectedMonth));
	const lastDaysOfMonths = [31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];

	const filter = () => {
		const acceptAnyCompany = selectedCompany.id === -1;
		const acceptAnyMonth = -1 === selectedMonthIdx;
		const acceptAnyYear = -1 === selectedYear;
		const getNewTourRows = () => {
			let newrows: Tour[] = [];
			if (acceptAnyCompany && acceptAnyMonth && acceptAnyYear) {
				return data.tours;
			}
			for (let row of data.tours) {
				if ((!acceptAnyYear && new Date(row.startTime).getFullYear() !== selectedYear) ||
					(!acceptAnyMonth && selectedMonthIdx !== new Date(row.startTime).getMonth()) ||
					(!acceptAnyCompany && row.companyId !== selectedCompany.id)
				) {
					continue;
				}
				newrows.push(row);
			}
			return newrows;
		};

		const getNewSubtractionRows = () => {
			const isInSpan = (day: number, spanStart: number, spanEnd: number) => {
				return day < spanEnd && day >= spanStart;
			};
			const choseThisYear = thisYear === selectedYear;
			const monthLeap = ((choseThisYear && data.isLeapYear) || (!choseThisYear && data.lastIsLeapYear));
			const leapYearShift = choseThisYear && data.lastIsLeapYear ? 1 : 0;
			const yearShift = leapYearShift + (choseThisYear ? 365 : 0);
			const timespanStart = 
				(selectedMonthIdx < 1 ? 0 : lastDaysOfMonths[selectedMonthIdx - 1]) + yearShift + (selectedMonthIdx > 2 && monthLeap ? 1 : 0);
			const timespanEnd = (selectedMonthIdx === - 1 ? 0 : lastDaysOfMonths[selectedMonthIdx]) + yearShift + (selectedMonthIdx > 1 && monthLeap ? 1 : 0);
			if (acceptAnyCompany && acceptAnyMonth && acceptAnyYear) {
				return data.companyCostsPerDay;
			}
			let newrows: Subtractions[] = [];
			for (let row of data.companyCostsPerDay) {
				if ((!acceptAnyYear && new Date(data.firstOfJanuaryLastYear + DAY * timespanStart + DAY).getFullYear() !== selectedYear) ||
					(!acceptAnyMonth && !isInSpan(row.day, timespanStart, timespanEnd)) ||
					(!acceptAnyCompany && row.companyId !== selectedCompany.id)
				) {
					continue;	
				}
				newrows.push(row);
			}
			return newrows;
		};
		currentRowsToursTable = getNewTourRows();
		currentRowsSubtractionsTable = getNewSubtractionRows();
		updateFiltered();
	};

	const getNewSum = (rows: Subtractions[]) => {
		let newSum = 0;
		for (let dayInfo of rows) {
			newSum += dayInfo.capped;
		}
		return newSum;
	};

	const restore = () => {
		currentRowsSubtractionsTable = data.companyCostsPerDay;
		currentRowsToursTable = data.tours;
		updateFiltered();
	};

	const updateFiltered = () => {
		prepareFilterString();
		selectedMonth = 'Monat';
		selectedCompany = { name: 'Unternehmen', id: -1 };
	};

	let filterString = $state('keine Filter ausgewählt');
	let sum = $state(getNewSum(data.companyCostsPerDay));

	const prepareFilterString = () => {
		if (
			selectedCompany.id == -1 &&
			selectedMonthIdx == -1
		) {
			filterString = 'keine Filter ausgewählt';
			return;
		}
		let result = ' ';
		if (selectedCompany.id != -1) {
			result = result.concat(selectedCompany.name, '; ');
		}
		if (selectedMonthIdx != -1) {
			result = result.concat(months[selectedMonthIdx], '; ');
		}
		filterString = result;
	};

	const csvExport = (currentTourData: Tour[], filename: string) => {
		currentTourData.sort((a, b) => a.startTime - b.startTime);
		let thisDay = new Date();
		let oneDayTours: Tour[] = [];
		let daySum = 0;
		let data = [];
		let isFirst = true;
		data.push(['Unternehmen', 'Tag', 'Taxameterstand', 'ÖV-Preis', 'Gesamtpreis', 'Kosten']);
		for (let row of currentTourData) {
			if (isFirst) {
				thisDay = new Date(row.startTime);
				isFirst = false;
			}
			if (thisDay.getTime() !== row.startTime) {
				daySum = 0; //computeDayCost(oneDayTours, thisDay);
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
		daySum = 0; //computeDayCost(oneDayTours, thisDay);
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

	let tables = [
		{ label: 'pro Tour', value: 1, component: tourTable },
		{ label: 'pro Tag', value: 2, component: subtractionTable }
	];
</script>

{#snippet tourTable()}
	<div class="h-[50vh] min-w-[130vh] overflow-y-auto">
	  <Table.Root class="w-full">
		<Table.Header class="sticky top-0 z-10">
		  <Table.Row>
			<Table.Head>Unternehmen</Table.Head>
			<Table.Head>
			  <Button class="whitespace-pre" variant="outline" onclick={() => sortTourColumn(0)}>
				{'Abfahrt  '}
				<ChevronsUpDown class="h-6 w-4" />
			  </Button>
			</Table.Head>
			<Table.Head>Ankunft</Table.Head>
			<Table.Head class="text-center">Anzahl Kunden</Table.Head>
			<Table.Head class="text-center">
			  <Button class="whitespace-pre" variant="outline" onclick={() => sortTourColumn(1)}>
				{'Taxameterstand  '}
				<ChevronsUpDown class="h-6 w-4" />
			  </Button>
			</Table.Head>
			<Table.Head class="text-center">
			  <Button class="whitespace-pre" variant="outline" onclick={() => sortTourColumn(2)}>
				{'Kosten  '}
				<ChevronsUpDown class="h-6 w-4" />
			  </Button>
			</Table.Head>
		  </Table.Row>
		</Table.Header>
		<Table.Body>
		  {#each currentRowsToursTable as tour}
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
	</div>
{/snippet}

{#snippet subtractionTable()}
	<div class="h-[50vh] min-w-[130vh] overflow-y-auto">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="mt-6.5">Unternehmen</Table.Head>
					<Table.Head class="mt-6.5 text-center">
						<Button class="whitespace-pre" variant="outline" onclick={() => sortSubtractionColumn(0, (a: Subtractions, b: Subtractions) => a.day - b.day)}>
							{'Tag '}
							<ChevronsUpDown class="h-6 w-4" />
						</Button>
					</Table.Head>
					<Table.Head class="mt-6.5">Anzahl Buchungen</Table.Head>
					<Table.Head class="mt-6.5 text-center">
						<Button class="whitespace-pre" variant="outline" onclick={() => sortSubtractionColumn(1, (a: Subtractions, b: Subtractions) => a.taxameter - b.taxameter)}>
							{'Taxameterstand kumuliert '}
							<ChevronsUpDown class="h-6 w-4" />
						</Button>
					</Table.Head>
					<Table.Head class="mt-6.5 text-center">
						<Button class="whitespace-pre" variant="outline" onclick={() => sortSubtractionColumn(2, (a: Subtractions, b: Subtractions) => a.uncapped - b.uncapped)}>
							{'Kosten ohne Obergrenze  '}
							<ChevronsUpDown class="h-6 w-4" />
						</Button>
					</Table.Head>
					<Table.Head class="mt-6.5 text-center">
						<Button class="whitespace-pre" variant="outline" onclick={() => sortSubtractionColumn(3, (a: Subtractions, b: Subtractions) => a.capped - b.capped)}>
							{'Kosten mit Obergrenze  '}
							<ChevronsUpDown class="h-6 w-4" />
						</Button>
					</Table.Head>
					<Table.Head class="mt-6.5 text-center">
						<Button class="whitespace-pre" variant="outline" onclick={() => sortSubtractionColumn(4, (a: Subtractions, b: Subtractions) => a.uncapped - a.capped - b.uncapped + b.capped)}>
							{'Abzüge'}
							<ChevronsUpDown class="h-6 w-4" />
						</Button>
					</Table.Head>
					<Table.Head class="mt-6.5 text-center">
						<Button class="whitespace-pre" variant="outline" onclick={() => sortSubtractionColumn(5, (a: Subtractions, b: Subtractions) => a.availabilityDuration - b.availabilityDuration)}>
							{'gesetzte Verfügbarkeit'}
							<ChevronsUpDown class="h-6 w-4" />
						</Button>
					</Table.Head>
				</Table.Row>
			</Table.Header>
				<Table.Body>
					{#each currentRowsSubtractionsTable as subtraction}
						<Table.Row>
							<Table.Cell>{subtraction.companyName}</Table.Cell>
							<Table.Cell class="text-center">{dayIdxToString(subtraction.day)}</Table.Cell>
							<Table.Cell class="text-center">{subtraction.customerCount}</Table.Cell>
							<Table.Cell class="text-center">{getEuroString(subtraction.taxameter)} €</Table.Cell>
							<Table.Cell class="text-center">{getEuroString(subtraction.uncapped)} €</Table.Cell>
							<Table.Cell class="text-center">{getEuroString(subtraction.capped)} €</Table.Cell>
							<Table.Cell class="text-center"
								>{getEuroString(subtraction.uncapped - subtraction.capped)} €</Table.Cell
							>
							<Table.Cell class="text-center"
								>{displayDuration(subtraction.availabilityDuration)}</Table.Cell
							>
						</Table.Row>
					{/each}
				</Table.Body>
		</Table.Root>
	</div>
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
								{c.name}
							</option>
						{/each}
					</select>
				</div>
				<div class="grid grid-cols-2 items-center gap-4">
					<Label for="timespan" class="text-left">Filter nach Monat:</Label>
					<select class={buttonVariants({ variant: 'outline' })} bind:value={selectedMonth}>
						<option selected = {true} value = {'Monat'}>Monat</option>
						{#each months as t}
							<option value={t}>
								{t}
							</option>
						{/each}
					</select>
					<Label for="timespan" class="text-left">Filter nach Jahr:</Label>
					<select class={buttonVariants({ variant: 'outline' })} bind:value={selectedYear}>
						<option selected={true} value={-1}>{'Jahr'}</option>
						<option value={thisYear}>{thisYear}</option>
						<option value={thisYear - 1}>{thisYear - 1}</option>
					</select>
				</div>
				<Dialog.Close class="text-right">
					<Button type="submit" onclick={filter}>Filter anwenden</Button>
				</Dialog.Close>
			</Dialog.Content>
		</Dialog.Root>
	</div>
	<Card.Content class="h-full w-full">
		<Tabs items={tables} />
		<Label
			>Summe aller Kosten unter Berücksichtigung der Obergrenze im gewählten Zeitraum: {getEuroString(
				sum
			)} €</Label
		>
	</Card.Content>
</div>
