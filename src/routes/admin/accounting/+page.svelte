<script lang="ts">
	import * as Card from '$lib/shadcn/card';
	import { Button, buttonVariants } from '$lib/shadcn/button';
	import Papa from 'papaparse';
	import pkg from 'file-saver';
	import type { TourWithRequests } from '$lib/server/db/getTours';
	import { FIXED_PRICE } from '$lib/constants.js';
	import Tabs from '$lib/ui/Tabs.svelte';
	import { HOUR, MINUTE, SECOND } from '$lib/util/time.js';
	import SortableScrollableTable, { type Column } from '$lib/ui/SortableScrollableTable.svelte';
	import Select from '$lib/ui/Select.svelte';
	import type { UnixtimeMs } from '$lib/util/UnixtimeMs.js';
	import { RangeCalendar } from '$lib/shadcn/range-calendar/index.js';
	import * as Dialog from '$lib/shadcn/dialog';
	import { CalendarDate } from '@internationalized/date';
	import { groupBy } from '$lib/util/groupBy';

	let range: {
		start: CalendarDate | undefined;
		end: CalendarDate | undefined;
	} = $state({
		start: undefined,
		end: undefined
	});

	const { saveAs } = pkg;
	const { data } = $props();

	let currentRowsToursTable: TourWithRequests[] = $state(data.tours);
	let currentRowsSubtractionsTable: Subtractions[] = $state(data.companyCostsPerDay);

	const updateCompanySums = (subtractionRows: Subtractions[]) => {
		const costsPerCompany = groupBy(
			subtractionRows,
			(c) => c.companyId,
			(c) => c
		);
		const newCompanyRows: CompanyRow[] = [];
		costsPerCompany.forEach((arr, companyId) => {
			if (arr.length === 0) {
				return;
			}
			const accumulated = arr.reduce(
				(acc, current) => {
					acc.capped += current.capped;
					acc.uncapped += current.uncapped;
					acc.taxameter += current.taxameter;
					acc.availabilityDuration += current.availabilityDuration;
					acc.customerCount += current.customerCount;
					return acc;
				},
				{ capped: 0, uncapped: 0, taxameter: 0, availabilityDuration: 0, customerCount: 0 }
			);
			newCompanyRows.push({ ...accumulated, companyName: arr[0].companyName, companyId });
		});
		if (newCompanyRows.length === 0) {
			return;
		}
		newCompanyRows.push({
			...newCompanyRows.reduce(
				(acc, current) => {
					acc.capped += current.capped;
					acc.uncapped += current.uncapped;
					acc.taxameter += current.taxameter;
					acc.availabilityDuration += current.availabilityDuration;
					acc.customerCount += current.customerCount;
					return acc;
				},
				{ capped: 0, uncapped: 0, taxameter: 0, availabilityDuration: 0, customerCount: 0 }
			),
			companyId: -1,
			companyName: 'Summiert'
		});
		return newCompanyRows;
	};
	let currentCompanyRows: CompanyRow[] = $state(updateCompanySums(data.companyCostsPerDay)!);

	const getNewSum = (rows: Subtractions[]) => {
		let newSum = 0;
		for (let dayInfo of rows) {
			newSum += dayInfo.capped;
		}
		return newSum;
	};
	let sum = $state(getNewSum(data.companyCostsPerDay));

	const years: number[] = [];
	for (
		let i = new Date(Date.now()).getFullYear();
		i != new Date(data.earliestTime).getFullYear() - 1;
		--i
	) {
		years.push(i);
	}

	const getCustomerCount = (tour: TourWithRequests) => {
		let customers = 0;
		tour.requests.forEach((r) => {
			customers += r.passengers;
		});
		return customers;
	};

	const getTourCost = (tour: TourWithRequests) => {
		return Math.max(0, (tour.fare ?? 0) - FIXED_PRICE * getCustomerCount(tour));
	};

	const getEuroString = (price: number | null) => {
		return ((price ?? 0) / 100).toFixed(2) + '€';
	};

	const displayDuration = (duration: number) => {
		const rounded = Math.floor(duration / HOUR);
		const minutes = ((duration / HOUR - rounded) * MINUTE) / SECOND;
		return (rounded < 10 ? '0' : '') + rounded + ':' + (minutes < 10 ? '0' : '') + minutes;
	};

	type CompanyRow = {
		taxameter: number;
		companyId: number;
		companyName: string | null;
		capped: number;
		uncapped: number;
		availabilityDuration: number;
		customerCount: number;
	};

	type Subtractions = CompanyRow & { timestamp: UnixtimeMs };

	const getNewRows = <T,>(
		ignoredFilters: boolean[],
		filters: ((row: T) => boolean)[],
		rows: T[]
	) => {
		let newrows: T[] = [];
		if (!ignoredFilters.some((f) => !f)) {
			return rows;
		}
		for (let row of rows) {
			if (!filters.some((f, i) => !ignoredFilters[i] && !f(row))) {
				newrows.push(row);
			}
		}
		return newrows;
	};

	// Filter
	$effect(() => {
		const ignoredFilters = [
			-1 === selectedCompanyIdx,
			-1 === selectedMonthIdx,
			-1 === selectedQuarterIdx,
			range.start === undefined,
			-1 === selectedYear
		];
		currentRowsToursTable = getNewRows(ignoredFilters, tourFilters, data.tours);
		const subtractionRows = getNewRows(ignoredFilters, subtractionFilters, data.companyCostsPerDay);
		currentCompanyRows = updateCompanySums(subtractionRows)!;
		currentRowsSubtractionsTable = subtractionRows;
	});

	$effect(() => {});

	const companyNames: string[] = [];
	for (let tour of data.tours) {
		if (tour.companyName && companyNames.find((c) => c == tour.companyName) === undefined) {
			companyNames.push(tour.companyName!);
		}
	}
	companyNames.sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
	let selectedCompanyIdx = $state(-1);

	const months = [
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
	const quarters = ['Quartal 1', 'Quartal 2', 'Quartal 3', 'Quartal 4'];
	let selectedMonthIdx = $state(-1);
	let selectedQuarterIdx = $state(-1);
	let selectedYearIdx = $state(-1);
	let selectedYear = $derived(selectedYearIdx === -1 ? -1 : years[selectedYearIdx]);

	const tourFilters = [
		(row: TourWithRequests) => row.companyName === companyNames[selectedCompanyIdx],
		(row: TourWithRequests) => selectedMonthIdx === new Date(row.startTime).getMonth(),
		(row: TourWithRequests) => {
			const month = new Date(row.startTime).getMonth();
			return selectedQuarterIdx * 3 <= month && month < (selectedQuarterIdx + 1) * 3;
		},
		(row: TourWithRequests) => {
			const asDate = new Date(row.startTime);
			const asCalendarDate = new CalendarDate(
				asDate.getFullYear(),
				asDate.getMonth() + 1,
				asDate.getDate()
			);
			return asCalendarDate.compare(range.start!) >= 0 && asCalendarDate.compare(range.end!) <= 0;
		},
		(row: TourWithRequests) => new Date(row.startTime).getFullYear() === selectedYear
	];

	const subtractionFilters = [
		(row: Subtractions) => row.companyName === companyNames[selectedCompanyIdx],
		(row: Subtractions) => new Date(row.timestamp).getMonth() === selectedMonthIdx,
		(row: Subtractions) => {
			const month = new Date(row.timestamp).getMonth();
			return selectedQuarterIdx * 3 <= month && month < (selectedQuarterIdx + 1) * 3;
		},
		(row: Subtractions) => {
			const asDate = new Date(row.timestamp);
			const asCalendarDate = new CalendarDate(
				asDate.getFullYear(),
				asDate.getMonth() + 1,
				asDate.getDate()
			);
			return asCalendarDate.compare(range.start!) >= 0 && asCalendarDate.compare(range.end!) <= 0;
		},
		(row: Subtractions) => new Date(row.timestamp).getFullYear() === selectedYear
	];

	const tourCols: Column<TourWithRequests>[] = [
		{
			text: 'Unternehmen',
			sort: undefined,
			toTableEntry: (r: TourWithRequests) => r.companyName ?? ''
		},
		{
			text: 'Abfahrt  ',
			sort: (t1: TourWithRequests, t2: TourWithRequests) => t1.startTime - t2.startTime,
			toTableEntry: (r: TourWithRequests) =>
				new Date(r.startTime).toLocaleString('de-DE').slice(0, -3)
		},
		{
			text: 'Ankunft',
			sort: (t1: TourWithRequests, t2: TourWithRequests) => t1.endTime - t2.endTime,
			toTableEntry: (r: TourWithRequests) =>
				new Date(r.endTime).toLocaleString('de-DE').slice(0, -3)
		},
		{
			text: 'Anzahl Kunden',
			sort: undefined,
			toTableEntry: (r: TourWithRequests) => getCustomerCount(r)
		},
		{
			text: 'Taxameterstand  ',
			sort: (t1: TourWithRequests, t2: TourWithRequests) => (t1.fare ?? 0) - (t2.fare ?? 0),
			toTableEntry: (r: TourWithRequests) => getEuroString(r.fare)
		},
		{
			text: 'Kosten  ',
			sort: (t1: TourWithRequests, t2: TourWithRequests) => getTourCost(t1) - getTourCost(t2),
			toTableEntry: (r: TourWithRequests) => getEuroString(getTourCost(r))
		}
	];

	const subtractionCols: Column<Subtractions>[] = [
		{
			text: 'Unternehmen',
			sort: undefined,
			toTableEntry: (r: Subtractions) => r.companyName ?? ''
		},
		{
			text: 'Tag  ',
			sort: (a: Subtractions, b: Subtractions) => a.timestamp - b.timestamp,
			toTableEntry: (r: Subtractions) => new Date(r.timestamp).toLocaleDateString('de-DE')
		},
		{ text: 'Buchungen', sort: undefined, toTableEntry: (r: Subtractions) => r.customerCount },
		{
			text: 'Taxameterstand kumuliert ',
			sort: (a: Subtractions, b: Subtractions) => a.taxameter - b.taxameter,
			toTableEntry: (r: Subtractions) => getEuroString(r.taxameter)
		},
		{
			text: 'Kosten ohne Obergrenze  ',
			sort: (a: Subtractions, b: Subtractions) => a.uncapped - b.uncapped,
			toTableEntry: (r: Subtractions) => getEuroString(r.uncapped)
		},
		{
			text: 'Kosten mit Obergrenze  ',
			sort: (a: Subtractions, b: Subtractions) => a.capped - b.capped,
			toTableEntry: (r: Subtractions) => getEuroString(r.capped)
		},
		{
			text: 'Abzüge  ',
			sort: (a: Subtractions, b: Subtractions) => a.uncapped - a.capped - b.uncapped + b.capped,
			toTableEntry: (r: Subtractions) => getEuroString(r.uncapped - r.capped)
		},
		{
			text: 'gesetzte Verfügbarkeit',
			sort: (a: Subtractions, b: Subtractions) => a.availabilityDuration - b.availabilityDuration,
			toTableEntry: (r: Subtractions) => displayDuration(r.availabilityDuration)
		}
	];

	const companyCols: Column<CompanyRow>[] = [
		{
			text: 'Unternehmen',
			sort: undefined,
			toTableEntry: (r: CompanyRow) => r.companyName ?? ''
		},
		{ text: 'Buchungen', sort: undefined, toTableEntry: (r: CompanyRow) => r.customerCount },
		{
			text: 'Taxameterstand kumuliert ',
			sort: (a: CompanyRow, b: CompanyRow) => a.taxameter - b.taxameter,
			toTableEntry: (r: CompanyRow) => getEuroString(r.taxameter)
		},
		{
			text: 'Kosten ohne Obergrenze  ',
			sort: (a: CompanyRow, b: CompanyRow) => a.uncapped - b.uncapped,
			toTableEntry: (r: CompanyRow) => getEuroString(r.uncapped)
		},
		{
			text: 'Kosten mit Obergrenze  ',
			sort: (a: CompanyRow, b: CompanyRow) => a.capped - b.capped,
			toTableEntry: (r: CompanyRow) => getEuroString(r.capped)
		},
		{
			text: 'Abzüge  ',
			sort: (a: CompanyRow, b: CompanyRow) => a.uncapped - a.capped - b.uncapped + b.capped,
			toTableEntry: (r: CompanyRow) => getEuroString(r.uncapped - r.capped)
		},
		{
			text: 'gesetzte Verfügbarkeit',
			sort: (a: CompanyRow, b: CompanyRow) => a.availabilityDuration - b.availabilityDuration,
			toTableEntry: (r: CompanyRow) => displayDuration(r.availabilityDuration)
		}
	];

	const csvExportBothTables = (
		tourRows: TourWithRequests[],
		subtractionRows: Subtractions[],
		filename: string
	) => {
		tourRows.sort((a, b) => a.startTime - b.startTime);
		subtractionRows.sort((a, b) => {
			const companyDifference = a.companyId - b.companyId;
			return companyDifference == 0 ? a.timestamp - b.timestamp : companyDifference;
		});

		const csvExport = <T,>(rows: T[], cols: Column<T>[], filename: string, addSumRow: boolean) => {
			let data = [];
			data.push(cols.map((col) => col.text));
			for (let row of rows) {
				data.push(cols.map((col) => col.toTableEntry(row)));
			}
			if (addSumRow) {
				const lastRow = ['Summe insgesamt'];
				for (let i = 0; i != cols.length - 4; ++i) {
					lastRow.push('');
				}
				lastRow.push(getEuroString(sum));
				data.push(lastRow);
			}
			const csvContent = Papa.unparse(data, { header: true });
			const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
			saveAs(blob, filename);
		};

		csvExport(tourRows, tourCols, filename + '_tour.csv', false);
		csvExport(subtractionRows, subtractionCols, filename + '_abzuege.csv', true);
	};

	let tables = [
		{ label: 'pro Tour', value: 1, component: tourTable },
		{ label: 'pro Tag', value: 2, component: subtractionTable },
		{ label: 'pro Unternehmen', value: 3, component: companyTable }
	];

	function resetFilter() {
		selectedCompanyIdx = -1;
		selectedMonthIdx = -1;
		selectedQuarterIdx = -1;
		range.start = undefined;
		range.end = undefined;
		selectedYearIdx = -1;
	}
</script>

{#snippet tourTable()}
	<SortableScrollableTable rows={currentRowsToursTable} cols={tourCols} />
{/snippet}

{#snippet subtractionTable()}
	<SortableScrollableTable rows={currentRowsSubtractionsTable} cols={subtractionCols} />
{/snippet}

{#snippet companyTable()}
	<SortableScrollableTable rows={currentCompanyRows} cols={companyCols} />
{/snippet}

{#snippet filterOptions()}
	<div class="grid gap-2 pb-4 pt-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
		<Select
			bind:selectedIdx={selectedCompanyIdx}
			entries={companyNames}
			initial={'Unternehmen'}
			disabled={null}
		/>
		<Select
			bind:selectedIdx={selectedMonthIdx}
			entries={months}
			initial={'Monat'}
			disabled={selectedQuarterIdx !== -1 || range.start != undefined}
		/>
		<Select
			bind:selectedIdx={selectedQuarterIdx}
			entries={quarters}
			initial={'Quartal'}
			disabled={selectedMonthIdx !== -1 || range.start != undefined}
		/>
		<Select
			bind:selectedIdx={selectedYearIdx}
			entries={years}
			initial={'Jahr'}
			disabled={range.start != undefined}
		/>
		<Dialog.Root>
			<Dialog.Trigger
				disabled={selectedMonthIdx !== -1 || selectedQuarterIdx !== -1 || selectedYearIdx !== -1}
				class="col-span-2 {buttonVariants({ variant: 'outline' })}"
				>{range.start === undefined
					? 'Zeitspanne'
					: range.start + ' - ' + range.end}</Dialog.Trigger
			>
			<Dialog.Content class="sm:max-w-[600px]">
				<RangeCalendar bind:value={range} class="rounded-md border" />
			</Dialog.Content>
		</Dialog.Root>
		<Button type="submit" onclick={() => resetFilter()}>Filter zurücksetzten</Button>
		<Button
			type="submit"
			onclick={() =>
				csvExportBothTables(currentRowsToursTable, currentRowsSubtractionsTable, 'Abrechnung')}
		>
			als CSV exportieren
		</Button>
	</div>
{/snippet}

<div class="flex flex-col overflow-y-auto">
	<Card.Header>
		<Card.Title>Abrechnung</Card.Title>
	</Card.Header>
	<Card.Content class="h-full w-full">
		<div class="flex flex-row">
			{@render filterOptions()}
		</div>
		<Tabs items={tables} />
	</Card.Content>
</div>
