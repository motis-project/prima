<script lang="ts">
	const { data } = $props();

	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table/index.js';
	import { getStyle } from '$lib/style';
	import Map from '$lib/Map.svelte';
	import GeoJSON from '$lib/GeoJSON.svelte';
	import Layer from '$lib/Layer.svelte';
	import { getRoute } from '$lib/api';

	let selectedTourEvents = data.events;
	let vehicle = selectedTourEvents[0].vehicle;

	let route = getRoute({
		start: {
			lat: 50.106847864,
			lng: 8.6632053122,
			level: 0
		},
		destination: {
			lat: 49.872584079,
			lng: 8.6312708899,
			level: 0
		},
		profile: 'car',
		direction: 'forward'
	});
</script>

<Card.Root class="max-w-screen-lg">
	<Card.Header>
		<Card.Title>Übersicht</Card.Title>
	</Card.Header>
	<Card.Content class="max-w-screen-lg">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-[200px]">Abfahrt</Table.Head>
					<Table.Head class="w-[200px]">Ankunft</Table.Head>
					<Table.Head class="w-[200px]">Fahrzeug</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if selectedTourEvents != null}
					<Table.Row>
						<Table.Cell>{selectedTourEvents[0].departure.toLocaleString('de-DE')}</Table.Cell>
						<Table.Cell>{selectedTourEvents[0].arrival.toLocaleString('de-DE')}</Table.Cell>
						<Table.Cell>{vehicle}</Table.Cell>
					</Table.Row>
				{/if}
			</Table.Body>
		</Table.Root>
	</Card.Content>
</Card.Root>

<Card.Root class="max-w-screen-lg">
	<Card.Header>
		<Card.Title>Route</Card.Title>
	</Card.Header>
	<Card.Content class="max-w-screen-lg">
		<Map
			transformRequest={(url) => {
				if (url.startsWith('/')) {
					return { url: `https://europe.motis-project.de/tiles${url}` };
				}
			}}
			style={getStyle(0)}
			center={[8.563351200419433, 50]}
			zoom={10}
			className="h-[800px] w-auto"
		>
			{#await route then r}
				{#if r.type == 'FeatureCollection'}
					<GeoJSON id="route" data={r}>
						<Layer
							id="path-outline"
							type="line"
							layout={{
								'line-join': 'round',
								'line-cap': 'round'
							}}
							filter={true}
							paint={{
								'line-color': '#1966a4',
								'line-width': 7.5,
								'line-opacity': 0.8
							}}
						/>
						<Layer
							id="path"
							type="line"
							layout={{
								'line-join': 'round',
								'line-cap': 'round'
							}}
							filter={true}
							paint={{
								'line-color': '#42a5f5',
								'line-width': 5,
								'line-opacity': 0.8
							}}
						/>
					</GeoJSON>
				{/if}
			{/await}
		</Map>
	</Card.Content>
</Card.Root>

<Card.Root class="max-w-screen-lg">
	<Card.Header>
		<Card.Title>Tour Details</Card.Title>
		<Card.Description>Wegpunkte und Abfahrtszeiten und Route</Card.Description>
	</Card.Header>
	<Card.Content class="max-w-screen-lg">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-[200px]">Abfahrt</Table.Head>
					<Table.Head class="max-w-screen-lg">Straße</Table.Head>
					<Table.Head class="max-w-screen-lg">Hausnummer</Table.Head>
					<Table.Head class="max-w-screen-lg">Ort</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each selectedTourEvents as event}
					<Table.Row>
						<Table.Cell>{event.scheduled_time.toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
						<Table.Cell>{event.street}</Table.Cell>
						<Table.Cell>{event.house_number}</Table.Cell>
						<Table.Cell class="max-w-screen-lg">{event.postal_code} {event.city}</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Content>
</Card.Root>
