<script lang="ts">
	const { data } = $props();
	import * as Card from '$lib/components/ui/card';
	import { Toaster } from 'svelte-sonner';
	import * as Table from '$lib/components/ui/table/index.js';
	import type { TourDetails } from '../taxi/TourDetails.js';
	import TourDialog from '../taxi/TourDialog.svelte';

	const maintainer = false;

	const getTourInfoShort = (tour: TourDetails) => {
		let l1 = tour.events[0];
		let l2 = tour.events[tour.events.length - 1];

		if (!(l1.city && l2.city)) {
			return [l1.street, l2.street];
		}
		return [l1.city + ': ' + l1.street, l2.city + ': ' + l2.street];
	};

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
</script>

<Toaster />

<div class="w-full h-full">
	<Card.Header>
		<Card.Title>Abgeschlossene Fahrten</Card.Title>
	</Card.Header>
	<Card.Content class="w-full h-full">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					{#if maintainer}
						<Table.Head>Unternehmen</Table.Head>
					{:else}
						<Table.Head>Fahrzeug</Table.Head>
					{/if}
					<Table.Head>Von</Table.Head>
					<Table.Head>Nach</Table.Head>
					<Table.Head>Abfahrt</Table.Head>
					<Table.Head>Ankunft</Table.Head>
					<Table.Head>Anzahl Kunden</Table.Head>
					<Table.Head>Anzahl Stationen</Table.Head>
					<Table.Head>Gesamtfahrpreis</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each data.tours as tour}
					<Table.Row
						on:click={() => {
							selectedTour = { tours: [tour] };
						}}
						class="cursor-pointer"
					>
						{#if maintainer}
							<Table.Cell>{tour.company_id}</Table.Cell>
						{:else}
							<Table.Cell>{tour.license_plate}</Table.Cell>
						{/if}
						<Table.Cell>{getTourInfoShort(tour)[0]}</Table.Cell>
						<Table.Cell>{getTourInfoShort(tour)[1]}</Table.Cell>
						<Table.Cell>{tour.from.toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
						<Table.Cell>{tour.to.toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
						<Table.Cell>{getCustomerCount(tour)}</Table.Cell>
						<Table.Cell>{tour.events.length}</Table.Cell>
						<Table.Cell>TODO</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Content>
</div>

<TourDialog bind:open={selectedTour} />
