<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { type TourDetails } from '$lib/TourDetails.js';
	import { ChevronsUpDown } from 'lucide-svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import Label from '$lib/components/ui/label/label.svelte';
	import { onMount } from 'svelte';
	import { getLocalTimeZone, today, CalendarDate } from '@internationalized/date';
	import { RangeCalendar } from '$lib/components/ui/range-calendar/index.js';
	import Papa from 'papaparse';
	import pkg from 'file-saver';
	import { paginate, setCurrentPages } from '$lib/Paginate';
	import Paginate from '$lib/paginate.svelte';
	import type { Availability } from '$lib/types.js';

	const { data } = $props();

	const { saveAs } = pkg;

	const getCustomerCount = (tour: TourDetails) => {
		let customers: Set<string> = new Set<string>();
		tour.events.forEach((e) => {
			customers.add(e.customer_id!);
		});
		return customers.size;
	};

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
		if (fare_route - fare >= 0) {
			return Math.round((fare_route - fare) * 0.97);
		}
		return 0;
	};

	const getEuroString = (price: number | null) => {
		if (price == null) {
			return '0.00';
		}
		return (price / 100).toFixed(2);
	};

	let currentRows: TourDetails[] = [];
	let perPage = 5;
	let firstPage = data.tours.slice(0, perPage);
	let firstarray = [firstPage];
	let paginationInfo = $state<{
		page: number;
		currentPageRows: TourDetails[];
		totalPages: TourDetails[][];
	}>({ page: 0, currentPageRows: firstPage, totalPages: firstarray });

	onMount(() => {
		currentRows = data.tours;
		paginationInfo.totalPages = paginate(perPage, currentRows);
		setCompanys(currentRows);
	});

	// --- Sort: ---
	let descending = [true, true, true, true];

	const compareDate = (a: TourDetails, b: TourDetails) => {
		if (a.from.getFullYear() < b.from.getFullYear()) return -1;
		if (a.from.getFullYear() > b.from.getFullYear()) return 1;
		if (a.from.getMonth() < b.from.getMonth()) return -1;
		if (a.from.getMonth() > b.from.getMonth()) return 1;
		if (a.from.getDate() < b.from.getDate()) return -1;
		if (a.from.getDate() > b.from.getDate()) return 1;
		return 0;
	};

	const compareDateAvailibility = (a: Availability, b: Availability) => {
		if (a.start_time.getFullYear() < b.start_time.getFullYear()) return -1;
		if (a.start_time.getFullYear() > b.start_time.getFullYear()) return 1;
		if (a.start_time.getMonth() < b.start_time.getMonth()) return -1;
		if (a.start_time.getMonth() > b.start_time.getMonth()) return 1;
		if (a.start_time.getDate() < b.start_time.getDate()) return -1;
		if (a.start_time.getDate() > b.start_time.getDate()) return 1;
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
		const aTotal = getTotalPrice(a.fare, a.fare_route);
		const bTotal = getTotalPrice(b.fare, b.fare_route);
		if (aTotal < bTotal) return -1;
		if (aTotal > bTotal) return 1;
		return 0;
	};

	const compareCost = (a: TourDetails, b: TourDetails) => {
		const aCost = getCost(a.fare, a.fare_route);
		const bCost = getCost(b.fare, b.fare_route);
		if (aCost < bCost) return -1;
		if (aCost > bCost) return 1;
		return 0;
	};

	const sortColumn = (idx: number) => {
		switch (idx) {
			case 0: {
				currentRows.sort(compareDate);
				break;
			}
			case 1: {
				currentRows.sort(compareFareRoute);
				break;
			}
			case 2: {
				currentRows.sort(compareTotalPrice);
				break;
			}
			case 3: {
				currentRows.sort(compareCost);
				break;
			}
			default:
				return;
		}
		if (!descending[idx]) {
			currentRows.reverse();
		} else {
			for (let i = 0; i < descending.length; i++) {
				if (i != idx) descending[i] = true;
			}
		}
		descending[idx] = !descending[idx];
		paginationInfo.totalPages = paginate(perPage, currentRows);
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
		paginationInfo.totalPages = paginate(perPage, currentRows);
		paginationInfo.page = 0;
		paginationInfo.currentPageRows = setCurrentPages(
			paginationInfo.page,
			paginationInfo.totalPages
		);
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
		const targetYear = selectedTime === 'Letztes Jahr' ? year - 1 : year;
		for (let row of data.tours) {
			if (time && timespans.find((str) => str === selectedTime) == undefined) {
				newrows = data.tours;
				break;
			}
			let rowDate: CalendarDate = new CalendarDate(
				row.from.getFullYear(),
				row.from.getMonth() + 1,
				row.from.getDate()
			);
			if (
				(time &&
					row.from.getFullYear() == targetYear &&
					isMonthOk(selectedTime, row.from.getMonth())) ||
				(span && rowDate.compare(range.start) >= 0 && rowDate.compare(range.end) <= 0) ||
				(comp && span == false && time == false)
			) {
				if (!comp || (comp && row.company_name == selectedCompany)) {
					newrows.push(row);
				}
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
		paginationInfo.totalPages = paginate(perPage, currentRows);
		paginationInfo.page = 0;
		paginationInfo.currentPageRows = setCurrentPages(
			paginationInfo.page,
			paginationInfo.totalPages
		);
	};

	// --- Summation: per day per vehicle --- 

	// TODO: TESTEN

	const createCapForDay = (day: Date) => {
		let capSumPerDay: number[] = [];
		//let availabilities = data.availabilities;
		//availabilities.sort(compareDateAvailibility);
		for (let avail of data.availabilities) {
			// was wenn die Tour über den Tag drüber geht?
			if(avail.start_time.getTime() === day.getTime())
			// frage: wenn eine tour eingetragen wird wird die availability automatsich eingetragen?
			{
				console.log("capSum: %d", avail.vehicle);
				capSumPerDay[avail.vehicle] += avail.cap;
			}
		}
		return capSumPerDay;
	};

	const createSumForDay = (oneDay: TourDetails[]) => {
		let sumsPerDay: number[] = [];
		for (let tour of oneDay) {
			console.log("sumsPerDay: %d", tour.vehicle_id);
			sumsPerDay[tour.vehicle_id] += tour.fare_route ? tour.fare_route : 0;
		}
		return sumsPerDay;
	};

	const computeDayCost = (oneDay: TourDetails[], day: Date) => {
		//350€ + (400€-350€)*0.25 = 362.5€
		let sums = createSumForDay(oneDay); // 400
		let caps = createCapForDay(day);    // 350
		const accu = sums.map((item, idx) => item + (caps[idx] - item) * 0.25);
		let dayCost = 0;
		for (let i of accu) {
    		dayCost += i;
		}
		return dayCost;
	};


	// --- Summation: ---
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

	const summarize = (currentRows: TourDetails[]) => {
		sum = 0;
		let toIterate = data.tours;
		if (filterString != 'keine Filter ausgewählt') {
			toIterate = currentRows;
		}
		for (let row of toIterate) {
			sum += getCost(row.fare, row.fare_route);
		}
	};

	const csvExport = (currentTourData: TourDetails[], filename: string) => {
		currentTourData.sort(compareDate);
		let thisDay = new Date();
		let oneDayTours: TourDetails[] = [];
		let daySum = 0;
		let data = [];
		let isFirst = true;
		data.push(['Unternehmen', 'Tag', 'Taxameterpreis', 'ÖV-Preis', 'Gesamtpreis', 'Kosten']);
		for (let row of currentTourData) {
			if(isFirst) {
				thisDay = row.from;
				isFirst = false;
			}
			if(thisDay.getTime() !== row.from.getTime())
			{
				daySum = computeDayCost(oneDayTours, thisDay);
				// -- pro vehicle aber eine Summe anzeigen?
				data.push(['Summe Tag', thisDay.toLocaleString('de-DE').slice(0, -10), '', '', '', getEuroString(daySum)]);
				thisDay = row.from;
				daySum = 0;
				oneDayTours.length = 0;
			}
			data.push([
				row.company_name,
				row.from.toLocaleString('de-DE').slice(0, -10),
				getEuroString(row.fare_route),
				getEuroString(row.fare),
				getEuroString(getTotalPrice(row.fare, row.fare_route)),
				getEuroString(getCost(row.fare, row.fare_route))
			]);
			oneDayTours.push(row);
		}
		// last "oneDayTours"
		daySum = computeDayCost(oneDayTours, thisDay);
		data.push(['Summe Tag', thisDay.toLocaleString('de-DE').slice(0, -10), '', '', '', getEuroString(daySum)]);
		data.push(['Summe insgesamt', '', '', '', '', getEuroString(sum)]);
		const csvContent = Papa.unparse(data, { header: true });
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
				on:click={() => summarize(currentRows)}
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
						<Table.Row>
							<Table.Head class="mt-6.5">Unternehmen</Table.Head>
							<Table.Head class="mt-6.5">Tag</Table.Head>
							<Table.Head class="mt-6.5 text-center">Taxameterpreis</Table.Head>
							<Table.Head class="mt-6.5 text-center">ÖV-Preis</Table.Head>
							<Table.Head class="mt-6.5 text-center">Gesamtpreis</Table.Head>
							<Table.Head class="mt-6.5 text-center">Kosten</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each paginationInfo.currentPageRows as tour}
							<Table.Row>
								<Table.Cell>{tour.company_name}</Table.Cell>
								<Table.Cell>{tour.from.toLocaleString('de-DE').slice(0, -10)}</Table.Cell>
								<Table.Cell class="text-center">{getEuroString(tour.fare_route)} €</Table.Cell>
								<Table.Cell class="text-center">{getEuroString(tour.fare)} €</Table.Cell>
								<Table.Cell class="text-center"
									>{getEuroString(getTotalPrice(tour.fare, tour.fare_route))} €</Table.Cell
								>
								<Table.Cell class="text-center"
									>{getEuroString(getCost(tour.fare, tour.fare_route))} €</Table.Cell
								>
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
					<Button type="submit" on:click={() => csvExport(currentRows, 'Abrechnung')}>
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
					<Button class="whitespace-pre" variant="outline" on:click={() => sortColumn(0)}>
						{'Abfahrt  '}
						<ChevronsUpDown class="h-6 w-4" />
					</Button>
				</Table.Head>
				<Table.Head class="mt-6.5">Ankunft</Table.Head>
				<Table.Head class="mt-6.5 text-center">Anzahl Kunden</Table.Head>
				<Table.Head class="mt-6.5 text-center">
					<Button class="whitespace-pre" variant="outline" on:click={() => sortColumn(1)}>
						{'Taxameterpreis  '}
						<ChevronsUpDown class="h-6 w-4" />
					</Button>
				</Table.Head>
				<Table.Head class="mt-6.5 text-center">ÖV-Preis</Table.Head>
				<Table.Head class="mt-6.5 text-center">
					<Button class="whitespace-pre" variant="outline" on:click={() => sortColumn(2)}>
						{'Gesamtpreis  '}
						<ChevronsUpDown class="h-6 w-4" />
					</Button>
				</Table.Head>
				<Table.Head class="mt-6.5 text-center">
					<Button class="whitespace-pre" variant="outline" on:click={() => sortColumn(3)}>
						{'Kosten  '}
						<ChevronsUpDown class="h-6 w-4" />
					</Button>
				</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each paginationInfo.currentPageRows as tour}
				<Table.Row>
					<Table.Cell>{tour.company_name}</Table.Cell>
					<Table.Cell>{tour.from.toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
					<Table.Cell>{tour.to.toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
					<Table.Cell class="text-center">{getCustomerCount(tour)}</Table.Cell>
					<Table.Cell class="text-center">{getEuroString(tour.fare_route)} €</Table.Cell>
					<Table.Cell class="text-center">{getEuroString(tour.fare)} €</Table.Cell>
					<Table.Cell class="text-center"
						>{getEuroString(getTotalPrice(tour.fare, tour.fare_route))} €</Table.Cell
					>
					<Table.Cell class="text-center"
						>{getEuroString(getCost(tour.fare, tour.fare_route))} €</Table.Cell
					>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<Paginate bind:open={paginationInfo} />
</Card.Content>
