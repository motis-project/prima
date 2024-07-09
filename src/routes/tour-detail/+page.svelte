<script lang="ts">
	const { data } = $props();

	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table/index.js';
	import { getStyle } from '$lib/style';

	let selectedTourEvents = data.events;
	let vehicle = selectedTourEvents[0].vehicle;

	let map = $state<null | maplibregl.Map>(null);

	let level = $state(0);
</script>

<div class="flex min-h-screen">
	<Card.Root class="w-fit m-auto">
		<Card.Header>
			<Card.Title>Tour Details</Card.Title>
			<Card.Description>Wegpunkte, Abfahrtszeiten und Route</Card.Description>
		</Card.Header>
		<Card.Content class="mt-8">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-[100px]">Abfahrt</Table.Head>
						<Table.Head class="w-[100px]">Ankunft</Table.Head>
						<Table.Head class="text-right">Fahrzeug</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#if selectedTourEvents != null}
						<Table.Row>
							<Table.Cell>{selectedTourEvents[0].departure.toLocaleString('de-DE')}</Table.Cell>
							<Table.Cell>{selectedTourEvents[0].arrival.toLocaleString('de-DE')}</Table.Cell>
							<Table.Cell class="text-right">{vehicle}</Table.Cell>
						</Table.Row>
					{/if}
				</Table.Body>
			</Table.Root>

			<!-- <Map
				bind:map
				transformRequest={(url: any, _resourceType: any) => {
					if (url.startsWith('/')) {
						return { url: `https://europe.motis-project.de/tiles${url}` };
					}
				}}
				center={[8.563351200419433, 50]}
				zoom={10}
				class="h-screen"
				style={getStyle(level)}
			></Map> -->

			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-[100px]">Abfahrt</Table.Head>
						<Table.Head class="w-[100px]">Straße</Table.Head>
						<Table.Head class="w-[100px]">Hausnummer</Table.Head>
						<Table.Head class="text-right">Ort</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each selectedTourEvents as event}
						<Table.Row>
							<Table.Cell>{event.scheduled_time.toLocaleString('de-DE')}</Table.Cell>
							<Table.Cell>{event.street}</Table.Cell>
							<Table.Cell>{event.house_number}</Table.Cell>
							<Table.Cell class="text-right">{event.postal_code} {event.city}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>
