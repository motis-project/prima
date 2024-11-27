<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table/index.js';
	import { getTourInfoShort, type TourDetails } from '$lib/TourDetails.js';
	import TourDialog from '$lib/TourDialog.svelte';
	import { onMount } from 'svelte';
	import { paginate } from '$lib/Paginate';
	import Paginate from './paginate.svelte';

	type Props = {
		isMaintainer: boolean;
		tours: TourDetails[];
	};
	let { isMaintainer, tours }: Props = $props();

	let selectedTour = $state<{
		tours: Array<TourDetails> | undefined;
	}>({ tours: undefined });

	const getCustomerCount = (tour: TourDetails) => {
		let customers: Set<string> = new Set<string>();
		tour.events.forEach((e) => {
			customers.add(e.customer_id!);
		});
		return customers.size;
	};

	// --- Pageination ---
	let currentRows: TourDetails[] = [];
	let perPage = 5;
	let firstPage = tours.slice(0, perPage);
	let firstarray = [firstPage];
	let paginationInfo = $state<{
		page: number;
		currentPageRows: TourDetails[];
		totalPages: TourDetails[][];
	}>({ page: 0, currentPageRows: firstPage, totalPages: firstarray });

	onMount(() => {
		currentRows = tours;
		paginationInfo.totalPages = paginate(perPage, currentRows);
	});

	const getTotalPrice = (fare: number | null, fare_route: number | null) => {
		if (fare == null || fare_route == null) {
			return 0;
		}
		let cost = 0;
		let diff = Math.max(0, fare_route - fare);
		if (diff > 0) {
			cost = (fare_route - fare) * 0.97;
		}
		return (Math.round(fare + cost) / 100).toFixed(2);
	};
</script>

<div class="w-full h-full">
	<Card.Header>
		<Card.Title>Abgeschlossene Fahrten</Card.Title>
	</Card.Header>
	<Card.Content class="w-full h-full">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					{#if isMaintainer}
						<Table.Head>Unternehmen</Table.Head>
					{:else}
						<Table.Head>Fahrzeug</Table.Head>
					{/if}
					<Table.Head>Von</Table.Head>
					<Table.Head>Nach</Table.Head>
					<Table.Head>Abfahrt</Table.Head>
					<Table.Head>Ankunft</Table.Head>
					<Table.Head>Anzahl Kunden</Table.Head>
					<Table.Head>No-Show</Table.Head>
					<Table.Head>Anzahl Stationen</Table.Head>
					<Table.Head>Gesamtfahrpreis</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each paginationInfo.currentPageRows as tour}
					<Table.Row
						on:click={() => {
							selectedTour = { tours: [tour] };
						}}
						class="cursor-pointer"
					>
						{#if isMaintainer}
							<Table.Cell>{tour.company_name}</Table.Cell>
						{:else}
							<Table.Cell>{tour.license_plate}</Table.Cell>
						{/if}
						<Table.Cell>{getTourInfoShort(tour)[0]}</Table.Cell>
						<Table.Cell>{getTourInfoShort(tour)[1]}</Table.Cell>
						<Table.Cell>{tour.from.toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
						<Table.Cell>{tour.to.toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
						<Table.Cell class="text-center">{getCustomerCount(tour)}</Table.Cell>
						<Table.Cell>TODO</Table.Cell>
						<Table.Cell class="text-center">{tour.events.length}</Table.Cell>
						<Table.Cell class="text-center"
							>{getTotalPrice(tour.fare, tour.fare_route)} €</Table.Cell
						>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Content>
</div>

<Paginate bind:open={paginationInfo} />

<TourDialog bind:open={selectedTour} />
