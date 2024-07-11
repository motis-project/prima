<script lang="ts">
	const { data } = $props();

	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table/index.js';
	import { getStyle } from '$lib/style';
	import Map from '$lib/Map.svelte';
	import GeoJSON from '$lib/GeoJSON.svelte';
	import Layer from '$lib/Layer.svelte';
	import { getRoute } from '$lib/api';
	import ScrollArea from '$lib/components/ui/scroll-area/scroll-area.svelte';

	let selectedTourEvents = data.events;
	let vehicle = selectedTourEvents[0].vehicle;

	const getRoutes = () => {
		let routes = [];

		for (let e = 0; e < selectedTourEvents.length - 1; e++) {
			let e1 = selectedTourEvents[e];
			let e2 = selectedTourEvents[e + 1];

			let route = getRoute({
				start: {
					lat: e1.latitude,
					lng: e1.longitude,
					level: 0
				},
				destination: {
					lat: e2.latitude,
					lng: e2.longitude,
					level: 0
				},
				profile: 'car',
				direction: 'forward'
			});
			routes.push(route);
		}
		// Promise.all(routes).then((values) => {
		// 	return values;
		// });
		console.log(routes);
		return routes;
	};

	const getCenter = () => {
		let nEvents = selectedTourEvents.length;
		if (nEvents == 0) return;
		return {
			lat: selectedTourEvents.map((e) => e.latitude).reduce((e, c) => e + c, 0) / nEvents,
			lng: selectedTourEvents.map((e) => e.longitude).reduce((e, c) => e + c, 0) / nEvents
		};
	};

	let center = getCenter();
	let routes = getRoutes();
	console.log(routes);
</script>

<div class="grid grid-cols-2 grid-rows-1">
	<div class="inline-flex flex-col">
		<div>
			<Card.Root>
				<Card.Header>
					<Card.Title>Übersicht</Card.Title>
				</Card.Header>
				<Card.Content>
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
		</div>
		<div>
			<Card.Root>
				<Card.Header>
					<Card.Title>Tour Details</Card.Title>
					<Card.Description>Wegpunkte und Abfahrtszeiten</Card.Description>
				</Card.Header>
				<Card.Content class="h-[634px]">
					<ScrollArea class="w-[640px] h-[610px] rounded-md border p-4">
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head class="w-[120px]">Abfahrt</Table.Head>
									<Table.Head class="w-[500px]">Straße</Table.Head>
									<Table.Head class="w-[20px]">Hausnummer</Table.Head>
									<Table.Head class="w-[220px]">Ort</Table.Head>
								</Table.Row>
							</Table.Header>

							<Table.Body>
								{#each selectedTourEvents as event}
									<Table.Row>
										<Table.Cell
											>{event.scheduled_time.toLocaleString('de-DE').slice(0, -3)}</Table.Cell
										>
										<Table.Cell>{event.street}</Table.Cell>
										<Table.Cell>{event.house_number}</Table.Cell>
										<Table.Cell>{event.postal_code} {event.city}</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					</ScrollArea>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
	<div>
		<Card.Root>
			<Card.Header>
				<Card.Title>Route</Card.Title>
			</Card.Header>
			<Card.Content>
				<Map
					transformRequest={(url) => {
						if (url.startsWith('/')) {
							return { url: `https://europe.motis-project.de/tiles${url}` };
						}
					}}
					style={getStyle(0)}
					center={[center!.lng, center!.lat]}
					zoom={10}
					className="h-[800px] w-auto"
				>
					{#each routes as route, i}
						{#await route then r}
							{#if r.type == 'FeatureCollection'}
								<GeoJSON id={i.toString()} data={r}>
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
					{/each}
				</Map>
			</Card.Content>
		</Card.Root>
	</div>
</div>
