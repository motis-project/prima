<script lang="ts">
	import * as Card from '$lib/shadcn/card';
	import * as Dialog from '$lib/shadcn/dialog/index';
	import { Button, buttonVariants } from '$lib/shadcn/button';
	import Label from '$lib/shadcn/label/label.svelte';
	import { onMount } from 'svelte';
	import Papa from 'papaparse';
	import pkg from 'file-saver';
	import type { Tour } from '$lib/server/db/getTours';
	import { FIXED_PRICE } from '$lib/constants.js';
	import Tabs from '$lib/ui/Tabs.svelte';
	import { DAY, HOUR, MINUTE, SECOND } from '$lib/util/time.js';
	import SortableScrollableTable from '$lib/ui/SortableScrollableTable.svelte';

	const { data } = $props();

	const { saveAs } = pkg;

	const thisYear = new Date(Date.now()).getFullYear();

	const tourCols = [
		{text: 'Unternehmen', sort: undefined, toTableCell: (r: Tour) => r.companyName},
		{text: 'Abfahrt  ', sort:(t1: Tour, t2: Tour) => t1.startTime - t2.startTime, toTableCell: (r: Tour) => new Date(r.startTime).toLocaleString('de-DE').slice(0, -3)},
		{text: 'Ankunft', sort: undefined, toTableCell: (r: Tour) => new Date(r.endTime).toLocaleString('de-DE').slice(0, -3)},
		{text: 'Anzahl Kunden', sort: undefined, toTableCell: (r: Tour) => getCustomerCount(r)},
		{text: 'Taxameterstand  ', sort:(t1: Tour, t2: Tour) => (t1.fare ?? 0) - (t2.fare ?? 0), toTableCell: (r: Tour) => getEuroString(r.fare)},
		{text: 'Kosten  ', sort:(t1: Tour, t2: Tour) => getTourCost(t1) - getTourCost(t2), toTableCell: (r: Tour) => getEuroString(getTourCost(r))}
	];

	const subtractionCols = [
		{text: 'Unternehmen', toTableCell: (r: Subtractions) => r.companyName},
		{text: 'Tag  ', sort: (a: Subtractions, b: Subtractions) => a.day - b.day, toTableCell: (r: Subtractions) => dayIdxToString(r.day)},
		{text: 'Buchungen', toTableCell: (r: Subtractions) => r.customerCount},
		{text: 'Taxameterstand kumuliert ', sort: (a: Subtractions, b: Subtractions) => a.taxameter - b.taxameter, toTableCell: (r: Subtractions) => getEuroString(r.taxameter)},
		{text: 'Kosten ohne Obergrenze  ', sort: (a: Subtractions, b: Subtractions) => a.uncapped - b.uncapped, toTableCell: (r: Subtractions) => getEuroString(r.uncapped)},
		{text: 'Kosten mit Obergrenze  ', sort: (a: Subtractions, b: Subtractions) => a.capped - b.capped, toTableCell: (r: Subtractions) => getEuroString(r.capped)},
		{text: 'Abzüge  ', sort: (a: Subtractions, b: Subtractions) => a.uncapped - a.capped - b.uncapped + b.capped, toTableCell: (r: Subtractions) => getEuroString(r.uncapped - r.capped)},
		{
			text: 'gesetzte Verfügbarkeit', sort: (a: Subtractions, b: Subtractions) => a.availabilityDuration - b.availabilityDuration,
			toTableCell: (r: Subtractions) => displayDuration(r.availabilityDuration)
		},
	]

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
	<SortableScrollableTable rows={currentRowsToursTable} cols={tourCols}/>
{/snippet}

{#snippet subtractionTable()}
	<SortableScrollableTable rows={currentRowsSubtractionsTable} cols={subtractionCols}/>
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
