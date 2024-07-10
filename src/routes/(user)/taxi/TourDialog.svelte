<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Card from '$lib/components/ui/card';
	import { Tour } from './Tour';
	import { Event } from './Event';

	import { getStyle } from '$lib/style';
	import Map from '$lib/Map.svelte';
	import GeoJSON from '$lib/GeoJSON.svelte';
	import Layer from '$lib/Layer.svelte';
	import { getRoute } from '$lib/api';
	import { Root } from 'postcss';
	import { ScrollArea } from '$lib/components/ui/scroll-area';

	class Props {
		open!: { open: boolean };
		selectedTour!: Tour | null;
		selectedTourEvents!: Array<Event> | null;
	}
	const { open = $bindable(), selectedTourEvents, selectedTour }: Props = $props();

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

<Dialog.Root
	open={open.open}
	onOpenChange={(x) => {
		if (!x) {
			open.open = false;
		}
	}}
	on:close={() => history.back()}
>
	<Dialog.Content class="w-fit m-auto min-w-[1280px] h-auto">
		<Dialog.Header>
			<Dialog.Title>Tour Details</Dialog.Title>
			<Dialog.Description>
				<div class="grid grid-rows-2 gap-4">
					<div>
						<Card.Root class="row-span-1">
							<Card.Header>
								<Card.Title>Übersicht</Card.Title>
							</Card.Header>
							<Card.Content class="overflow-y-scroll max-h-screen">
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
												<Table.Cell>{selectedTour!.departure.toLocaleString('de-DE')}</Table.Cell>
												<Table.Cell>{selectedTour!.arrival.toLocaleString('de-DE')}</Table.Cell>
												<Table.Cell>{selectedTour!.vehicle_id}</Table.Cell>
											</Table.Row>
										{/if}
									</Table.Body>
								</Table.Root>
							</Card.Content>
						</Card.Root>
					</div>
					<div>
						<div class="grid grid-cols-2 gap-4">
							<div>
								<Card.Root class="">
									<Card.Header>
										<Card.Title>Tour Details</Card.Title>
										<Card.Description>Wegpunkte und Abfahrtszeiten und Route</Card.Description>
									</Card.Header>
									<Card.Content class="">
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
														<Table.Cell
															>{event.scheduled_time
																.toLocaleString('de-DE')
																.slice(0, -3)}</Table.Cell
														>
														<Table.Cell>{event.street}</Table.Cell>
														<Table.Cell>{event.house_number}</Table.Cell>
														<Table.Cell class="max-w-screen-lg"
															>{event.postal_code} {event.city}</Table.Cell
														>
													</Table.Row>
												{/each}
											</Table.Body>
										</Table.Root>
									</Card.Content>
								</Card.Root>
							</div>
							<div>
								<Card.Root class="">
									<Card.Header>
										<Card.Title>Route</Card.Title>
									</Card.Header>
									<Card.Content class="">
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
							</div>
						</div>
					</div>
				</div>
			</Dialog.Description>
		</Dialog.Header>
	</Dialog.Content>
</Dialog.Root>
