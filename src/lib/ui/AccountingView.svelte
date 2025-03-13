<script lang="ts">
	import * as Card from '$lib/shadcn/card';
	import { Button, buttonVariants } from '$lib/shadcn/button';
	import Papa from 'papaparse';
	import pkg from 'file-saver';
	import type { ToursWithRequests, TourWithRequests } from '$lib/util/getToursTypes';
	import Tabs from '$lib/ui/Tabs.svelte';
	import SortableTable from '$lib/ui/SortableTable.svelte';
	import Select from '$lib/ui/Select.svelte';
	import { RangeCalendar } from '$lib/shadcn/range-calendar/index.js';
	import * as Dialog from '$lib/shadcn/dialog';
	import { CalendarDate } from '@internationalized/date';
	import { groupBy } from '$lib/util/groupBy';
	import {
		companyColsAdmin,
		companyColsCompany,
		getEuroString,
		subtractionColsAdmin,
		subtractionColsCompany,
		tourColsAdmin,
		tourColsCompany,
		type Column,
		type CompanyRow,
		type Subtractions
	} from './tableData.js';
	import { MONTHS, QUARTERS } from '$lib/constants.js';
	import type { UnixtimeMs } from '$lib/util/UnixtimeMs.js';
	import TourDialog from './TourDialog.svelte';

	let range: {
		start: CalendarDate | undefined;
		end: CalendarDate | undefined;
	} = $state({
		start: undefined,
		end: undefined
	});

	const { saveAs } = pkg;
	const {
		isAdmin,
		tours,
		costPerDayAndVehicle,
		earliestTime,
		latestTime
	}: {
		isAdmin: boolean;
		tours: ToursWithRequests;
		costPerDayAndVehicle: Subtractions[];
		earliestTime: UnixtimeMs;
		latestTime: UnixtimeMs;
	} = $props();

	const updateCompanySums = (subtractionRows: Subtractions[]) => {
		const accumulateCompanyRowEntries = (arr: (Subtractions | CompanyRow)[]) => {
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
			const accumulated = accumulateCompanyRowEntries(arr);
			if (isAdmin) {
				newCompanyRows.push({ ...accumulated, companyName: arr[0].companyName, companyId });
			} else {
				newCompanyRows.push({ ...accumulated, companyId });
			}
		});
		if (isAdmin && newCompanyRows.length > 1) {
			newCompanyRows.push({
				...accumulateCompanyRowEntries(newCompanyRows),
				companyId: -1,
				companyName: 'Summiert'
			});
		}
		return newCompanyRows;
	};

	let currentRowsToursTable: TourWithRequests[] = $state(tours);
	let currentRowsSubtractionsTable: Subtractions[] = $state(costPerDayAndVehicle);
	let currentCompanyRows: CompanyRow[] = $state(updateCompanySums(costPerDayAndVehicle));

	const getNewSum = (rows: Subtractions[]) => {
		let newSum = 0;
		for (let dayInfo of rows) {
			newSum += dayInfo.capped;
		}
		return newSum;
	};
	let sum = $state(getNewSum(costPerDayAndVehicle));

	const years: number[] = [];
	for (
		let i = new Date(latestTime).getFullYear();
		i != new Date(earliestTime).getFullYear() - 1;
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
		currentRowsToursTable = getNewRows(tourFilters, tours).filter(
			(t) =>
				(selectedCancelledToursIdx == -1 || cancelledFilters[selectedCancelledToursIdx](t)) &&
				(selectedCompletedToursIdx === -1 || completedFilters[selectedCompletedToursIdx](t))
		);
		const subtractionRows = getNewRows(subtractionFilters, costPerDayAndVehicle);
		currentCompanyRows = updateCompanySums(subtractionRows);
		currentRowsSubtractionsTable = subtractionRows;
	});

	const companyNames: string[] = [];
	for (let tour of tours) {
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

	const filename = 'Abrechnung';
	const csvExport = <T extends Subtractions | TourWithRequests>(
		rows: T[],
		cols: Column<T>[],
		filename: string,
		addSumRow: boolean
	) => {
		let data = [];
		data.push(cols.map((col) => col.text.join(' ')));
		for (let row of rows) {
			data.push(cols.map((col) => col.toTableEntry(row)));
		}
		if (addSumRow) {
			const lastRow = ['Summe insgesamt'];
			for (let i = 0; i != cols.length - 3; ++i) {
				lastRow.push('');
			}
			lastRow.push(getEuroString(sum));
			data.push(lastRow);
		}
		const csvContent = Papa.unparse(data, { header: true });
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		saveAs(blob, filename);
	};

	const csvExportToursTable = (tourRows: TourWithRequests[]) => {
		tourRows.sort((a, b) => a.startTime - b.startTime);
		csvExport(tourRows, isAdmin ? tourColsAdmin : tourColsCompany, filename + '_tour.csv', false);
	};

	const csvExportDayTable = (subtractionRows: Subtractions[]) => {
		subtractionRows.sort((a, b) => {
			const companyDifference = a.companyId - b.companyId;
			return companyDifference == 0 ? a.timestamp - b.timestamp : companyDifference;
		});
		csvExport(
			subtractionRows,
			isAdmin ? subtractionColsAdmin : subtractionColsCompany,
			filename + '_abzuege.csv',
			true
		);
	};

	let tables = [
		{ label: 'pro Tour', value: 1, component: tourTable },
		{ label: 'pro Tag', value: 2, component: subtractionTable },
		{ label: isAdmin ? 'pro Unternehmen' : 'Summe', value: 3, component: companyTable }
	];

	let selectedCompletedToursIdx = $state(-1);
	let selectedCancelledToursIdx = $state(-1);

	let toggleTours1 = ['abgeschlossene', 'zukünftige'];

	const completedFilters = [
		(t: TourWithRequests) => t.fare != null,
		(t: TourWithRequests) => t.fare === null
	];
	const cancelledFilters = [
		(t: TourWithRequests) => t.cancelled,
		(t: TourWithRequests) => !t.cancelled
	];

	let toggleTours2 = ['stornierte', 'nicht stornierte'];

	function resetFilter() {
		selectedCompanyIdx = -1;
		selectedMonthIdx = -1;
		selectedQuarterIdx = -1;
		range.start = undefined;
		range.end = undefined;
		selectedYearIdx = -1;
		selectedCancelledToursIdx = -1;
		selectedCompletedToursIdx = -1;
	}

	let selectedToursTableRow: TourWithRequests[] | undefined = $state(undefined);
</script>

{#snippet tourTable()}
	<SortableTable
		bind:rows={currentRowsToursTable}
		cols={isAdmin ? tourColsAdmin : tourColsCompany}
		{isAdmin}
		getRowStyle={(row: TourWithRequests) =>
			'cursor-pointer ' +
			(row.cancelled ? (row.message === null ? 'bg-orange-500' : 'bg-destructive') : 'bg-white-0')}
		bind:selectedRow={selectedToursTableRow}
		bindSelectedRow={true}
	/>

	<TourDialog bind:tours={selectedToursTableRow} {isAdmin} />
{/snippet}

{#snippet subtractionTable()}
	<SortableTable
		bind:rows={currentRowsSubtractionsTable}
		cols={isAdmin ? subtractionColsAdmin : subtractionColsCompany}
		{isAdmin}
	/>
{/snippet}

{#snippet companyTable()}
	<SortableTable
		bind:rows={currentCompanyRows}
		cols={isAdmin ? companyColsAdmin : companyColsCompany}
		{isAdmin}
		fixLastRow={isAdmin}
	/>
{/snippet}

{#snippet filterOptions()}
	<div class="grid gap-2 pb-4 pt-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
		{#if isAdmin}
			<Select
				bind:selectedIdx={selectedCompanyIdx}
				entries={companyNames}
				initial={'Unternehmen'}
				disabled={null}
			/>
		{/if}
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
				class={buttonVariants({ variant: 'outline' })}
				>{range.start === undefined
					? 'Zeitspanne'
					: range.start + ' - ' + range.end}</Dialog.Trigger
			>
			<Dialog.Content class="sm:max-w-[600px]">
				<RangeCalendar bind:value={range} class="rounded-md border" />
			</Dialog.Content>
		</Dialog.Root>
		<Select
			bind:selectedIdx={selectedCompletedToursIdx}
			entries={toggleTours1}
			initial={'nach abgeschlossenen Touren filtern'}
			disabled={false}
		/>
		<Select
			bind:selectedIdx={selectedCancelledToursIdx}
			entries={toggleTours2}
			initial={'nach stornierten Touren filtern'}
			disabled={false}
		/>
		<Button type="submit" onclick={() => resetFilter()}>Filter zurücksetzten</Button>
		<Button type="submit" onclick={() => csvExportToursTable(currentRowsToursTable)}>
			pro Tour als CSV exportieren
		</Button>
		<Button type="submit" onclick={() => csvExportDayTable(currentRowsSubtractionsTable)}>
			pro Tag als CSV exportieren
		</Button>
	</div>
{/snippet}

<div class="h-[90vh]">
	<Card.Header>
		<Card.Title>Abrechnung</Card.Title>
	</Card.Header>
	<Card.Content>
		<div class="flex flex-row justify-start">
			{@render filterOptions()}
		</div>
		<Tabs items={tables} />
	</Card.Content>
</div>
