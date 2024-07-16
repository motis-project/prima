<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Card from '$lib/components/ui/card';
	import { Event } from './Event';

	import { getStyle } from '$lib/style';
	import Map from '$lib/Map.svelte';
	import GeoJSON from '$lib/GeoJSON.svelte';
	import Layer from '$lib/Layer.svelte';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { getRoute } from '$lib/api';

	type Tour = {
		id: number;
		vehicle: number;
		departure: Date;
		arrival: Date;
		license_plate: string;
	};

	class Props {
		open!: { tourId: number | undefined };
		selectedTour!: Tour | undefined;
		selectedTourEvents!: Array<Event> | null;
	}

	const { open = $bindable(), selectedTourEvents, selectedTour }: Props = $props();

	const getRoutes = (tourEvents: Array<Event> | null) => {
		// eslint-disable-next-line
		let routes: Array<Promise<any>> = [];
		if (tourEvents == null || tourEvents!.length == 0) {
			return routes;
		}

		for (let e = 0; e < tourEvents!.length - 1; e++) {
			let e1 = tourEvents![e];
			let e2 = tourEvents![e + 1];
			routes.push(
				getRoute({
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
				})
			);
		}
		return routes;
	};

	const getCenter = (tourEvents: Array<Event> | null): [number, number] => {
		if (tourEvents == null || tourEvents!.length == 0) {
			return [0, 0];
		}
		let nEvents = tourEvents!.length;
		return [
			tourEvents!.map((e) => e.longitude).reduce((e, c) => e + c, 0) / nEvents,
			tourEvents!.map((e) => e.latitude).reduce((e, c) => e + c, 0) / nEvents
		];
	};

	const routes = $derived(getRoutes(selectedTourEvents));
	const center = $derived(getCenter(selectedTourEvents));
</script>

<Dialog.Root
	open={open.tourId !== undefined}
	onOpenChange={(x) => {
		if (!x) {
			open.tourId = undefined;
		}
	}}
	on:close={() => history.back()}
>
	<Dialog.Content class="w-fit m-auto min-w-[1440px] h-auto">
		<Dialog.Header>
			<Dialog.Title>Tour Details</Dialog.Title>
			<Dialog.Description>
				<div class="grid grid-cols-2 grid-rows-1 gap-2 py-3">
					<div class="inline-flex flex-col gap-2">
						<div>
							<Card.Root>
								<Card.Header>
									<Card.Title>Übersicht</Card.Title>
								</Card.Header>
								<Card.Content>
									<Table.Root class="w-[620px]">
										<Table.Header>
											<Table.Row>
												<Table.Head class="w-[200px]">Abfahrt</Table.Head>
												<Table.Head class="w-[200px]">Ankunft</Table.Head>
												<Table.Head class="w-[200px]">Fahrzeug</Table.Head>
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{#if selectedTour && selectedTourEvents}
												<Table.Row>
													<Table.Cell>
														{selectedTour!.departure.toLocaleString('de-DE') .slice(0, -3)}
													</Table.Cell>
													<Table.Cell>
														{selectedTour!.arrival.toLocaleString('de-DE') .slice(0, -3)}
													</Table.Cell>
													<Table.Cell>{selectedTour!.license_plate}</Table.Cell>
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
								<Card.Content class="h-[626px]">
									<ScrollArea class="w-[640px] h-[604px] rounded-md border p-4">
										<Table.Root>
											<Table.Header>
												<Table.Row>
													<Table.Head class="w-[120px]">Abfahrt</Table.Head>
													<Table.Head class="w-[500px]">Straße</Table.Head>
													<Table.Head class="w-[20px]">Hausnummer</Table.Head>
													<Table.Head class="w-[220px]">Ort</Table.Head>
													<Table.Head class="w-[220px]">Kunde</Table.Head>
													<Table.Head class="w-[220px]">Fahrpreis</Table.Head>
												</Table.Row>
											</Table.Header>

											<Table.Body>
												{#if selectedTour && selectedTourEvents}
													{#each selectedTourEvents as event}
														<Table.Row>
															<Table.Cell
																>{event.scheduled_time
																	.toLocaleString('de-DE')
																	.slice(0, -3)
																	.replace(',', ' ')}</Table.Cell
															>
															<Table.Cell>{event.street}</Table.Cell>
															<Table.Cell>{event.house_number}</Table.Cell>
															<Table.Cell>{event.postal_code} {event.city}</Table.Cell>
															<Table.Cell></Table.Cell>
															<Table.Cell></Table.Cell>
														</Table.Row>
													{/each}
												{/if}
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
									{center}
									zoom={11}
									className="h-[800px] w-auto"
								>
									{#if routes != null}
										{#each routes as segment, i}
											{#await segment then r}
												{#if r.type == 'FeatureCollection'}
													<GeoJSON id={'r_ ' + i} data={r}>
														<Layer
															id={'path-outline_ ' + i}
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
															id={'path_ ' + i}
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
									{/if}
								</Map>
							</Card.Content>
						</Card.Root>
					</div>
				</div>
			</Dialog.Description>
		</Dialog.Header>
	</Dialog.Content>
</Dialog.Root>
