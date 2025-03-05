<script lang="ts">
	import * as Card from '$lib/shadcn/card';
	import { Button, buttonVariants } from '$lib/shadcn/button';
	import Papa from 'papaparse';
	import pkg from 'file-saver';
	import type { TourWithRequests } from '$lib/server/db/getTours';
	import Tabs from '$lib/ui/Tabs.svelte';
	import SortableTable from '$lib/ui/SortableTable.svelte';
	import Select from '$lib/ui/Select.svelte';
	import { RangeCalendar } from '$lib/shadcn/range-calendar/index.js';
	import * as Dialog from '$lib/shadcn/dialog';
	import { CalendarDate } from '@internationalized/date';
	import { groupBy } from '$lib/util/groupBy';
	import {
		companyCols,
		getEuroString,
		subtractionCols,
		tourCols,
		type Column,
		type CompanyRow,
		type Subtractions
	} from './tableData.js';
	import { MONTHS, QUARTERS } from '$lib/constants.js';

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
		const accumulatedCompanyRowEntries = (arr: (Subtractions | CompanyRow)[]) => {
			return arr.reduce(
				(acc, current) => {
					acc.capped += current.capped;
					acc.uncapped += current.uncapped;
					acc.taxameter += current.taxameter;
					acc.availabilityDuration += current.availabilityDuration;
					acc.customerCount += current.customerCount;
					acc.verifiedCustomerCount += current.verifiedCustomerCount;
					return acc;
				},
				{
					capped: 0,
					uncapped: 0,
					taxameter: 0,
					availabilityDuration: 0,
					customerCount: 0,
					verifiedCustomerCount: 0
				}
			);
		};
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
			const accumulated = accumulatedCompanyRowEntries(arr);
			newCompanyRows.push({ ...accumulated, companyName: arr[0].companyName, companyId });
		});
		if (newCompanyRows.length === 0) {
			return;
		}
		newCompanyRows.push({
			...accumulatedCompanyRowEntries(newCompanyRows),
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

	const getNewRows = <T,>(filters: ((row: T) => boolean)[], rows: T[]) => {
		const ignoredFilters = [
			-1 === selectedCompanyIdx,
			-1 === selectedMonthIdx,
			-1 === selectedQuarterIdx,
			range.start === undefined,
			-1 === selectedYearIdx
		];
		let newrows: T[] = [];
		for (let row of rows) {
			if (!filters.some((f, i) => !ignoredFilters[i] && !f(row))) {
				newrows.push(row);
			}
		}
		return newrows;
	};

	// Filter
	$effect(() => {
		currentRowsToursTable = getNewRows(tourFilters, data.tours);
		const subtractionRows = getNewRows(subtractionFilters, data.companyCostsPerDay);
		currentCompanyRows = updateCompanySums(subtractionRows)!;
		currentRowsSubtractionsTable = subtractionRows;
	});

	const companyNames: string[] = [];
	for (let tour of data.tours) {
		if (tour.companyName && companyNames.find((c) => c == tour.companyName) === undefined) {
			companyNames.push(tour.companyName!);
		}
	}
	companyNames.sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
	let selectedCompanyIdx = $state(-1);
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
	<SortableTable rows={currentRowsToursTable} cols={tourCols} selectedTour={undefined} />
{/snippet}

{#snippet subtractionTable()}
	<SortableTable rows={currentRowsSubtractionsTable} cols={subtractionCols} selectedTour={undefined} />
{/snippet}

{#snippet companyTable()}
	<SortableTable rows={currentCompanyRows} cols={companyCols} selectedTour={undefined} />
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
			entries={MONTHS}
			initial={'Monat'}
			disabled={selectedQuarterIdx !== -1 || range.start != undefined}
		/>
		<Select
			bind:selectedIdx={selectedQuarterIdx}
			entries={QUARTERS}
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

<div class="h-[90vh]">
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
