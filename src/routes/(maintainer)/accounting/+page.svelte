<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table/index.js';
	import { type TourDetails } from '$lib/TourDetails.js';

    const { data } = $props();

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
		<Card.Title>Abrechnung</Card.Title>
	</Card.Header>
	<Card.Content class="w-full h-full">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Unternehmen</Table.Head>
					<Table.Head>Abfahrt</Table.Head>
					<Table.Head>Ankunft</Table.Head>
					<Table.Head>Anzahl Kunden</Table.Head>
					<Table.Head>Taxameterpreis</Table.Head>
                    <Table.Head>ÖV-Preis</Table.Head>
                    <Table.Head>Preis</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each data.tours as tour}
					<Table.Row>
						<Table.Cell>{tour.company_name}</Table.Cell>
						<Table.Cell>{tour.from.toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
						<Table.Cell>{tour.to.toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
						<Table.Cell>{getCustomerCount(tour)}</Table.Cell>
						<Table.Cell>TODO</Table.Cell>
                        <Table.Cell>TODO</Table.Cell>
                        <Table.Cell>TODO</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Content>
</div>
