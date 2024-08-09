<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table/index.js';
	import { getTourInfoShort, type TourDetails } from './(user)/taxi/TourDetails.js';
	import TourDialog from './(user)/taxi/TourDialog.svelte';

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
				{#each tours as tour}
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
						<Table.Cell>{getCustomerCount(tour)}</Table.Cell>
						<Table.Cell>TODO</Table.Cell>
						<Table.Cell>{tour.events.length}</Table.Cell>
						<Table.Cell>TODO</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Content>
</div>

<TourDialog bind:open={selectedTour} {isMaintainer} />
