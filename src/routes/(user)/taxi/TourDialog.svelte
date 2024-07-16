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
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { getRoute } from '$lib/api';

	class Props {
		open!: { open: boolean };
		selectedTour!: Tour | null;
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

	const getCenter = (tourEvents: Array<Event> | null) => {
		if (tourEvents == null || tourEvents!.length == 0) {
			return { lat: 0, lng: 0 };
		}
		let nEvents = tourEvents!.length;
		return {
			lat: tourEvents!.map((e) => e.latitude).reduce((e, c) => e + c, 0) / nEvents,
			lng: tourEvents!.map((e) => e.longitude).reduce((e, c) => e + c, 0) / nEvents
		};
	};

	const routes = $derived(getRoutes(selectedTourEvents));
	const center = $derived(getCenter(selectedTourEvents));
</script>

<Dialog.Root
	open={open.open}
	onOpenChange={(x) => {
		if (!x) {
			open.open = false;
		}
	}}
	on:close={() => history.back()}
	on:close={() => history.back()}
>
	<Dialog.Content class="w-fit m-auto min-w-[1280px] h-auto">
		<Dialog.Header>
			<Dialog.Title>Tour Details</Dialog.Title>
			<Dialog.Description>
				<div class="grid grid-cols-1 grid-rows-2 gap-2 py-3">
					<div class="inline-flex flex-row gap-2">
						<div>
							<Card.Root>
								<Card.Header>
									<Card.Title>Übersicht</Card.Title>
								</Card.Header>
								<Card.Content class="w-[670px] h-[524px]">
									<Table.Root>
										<Table.Header>
											<Table.Row>
												<Table.Head>Abfahrt</Table.Head>
												<Table.Head>Ankunft</Table.Head>
												<Table.Head>Fahrzeug</Table.Head>
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{#if selectedTourEvents != null}
												<Table.Row>
													<Table.Cell>
														{selectedTour!.departure.toLocaleString('de-DE') .slice(0, -3)}
														<br />{selectedTourEvents[0].street}<br />
														{selectedTourEvents[0].postal_code}
														{selectedTourEvents[0].city}
													</Table.Cell>
													<Table.Cell>
														{selectedTour!.arrival.toLocaleString('de-DE') .slice(0, -3)}
														<br />{selectedTourEvents[selectedTourEvents.length - 1].street}<br />
														{selectedTourEvents[selectedTourEvents.length - 1].postal_code}
														{selectedTourEvents[selectedTourEvents.length - 1].city}
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
										className="h-[500px] w-[500px]"
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
					<div class="inline-flex flex-row gap-2">
						<Card.Root>
							<Card.Header>
								<Card.Title>Tour Details</Card.Title>
								<Card.Description
									>Wegpunkte, Abfahrtszeiten und Kundeninformationen</Card.Description
								>
							</Card.Header>
							<Card.Content class="h-[426px]">
								<ScrollArea class="w-[1180px] h-[404px] rounded-md p-4">
									<Table.Root>
										<Table.Header>
											<Table.Row>
												<Table.Head>Abfahrt</Table.Head>
												<Table.Head>Straße</Table.Head>
												<Table.Head>Hausnr.</Table.Head>
												<Table.Head>Ort</Table.Head>
												<Table.Head>Kunde</Table.Head>
												<Table.Head>Tel. Kunde</Table.Head>
												<Table.Head></Table.Head>
												<Table.Head class="text-right">Fahrpreis</Table.Head>
											</Table.Row>
										</Table.Header>

										<Table.Body>
											{#if selectedTourEvents != null}
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
														<Table.Cell>
															{event.last_name},
															{event.first_name}
														</Table.Cell>
														<Table.Cell>
															{event.phone}
														</Table.Cell>
														{#if event.is_pickup}
															<Table.Cell class="text-green-500 text-2xl">&#x21E6</Table.Cell>
														{:else}
															<Table.Cell class="text-red-500 text-2xl">&#x21E8</Table.Cell>
														{/if}
														<Table.Cell class="text-right">42,42</Table.Cell>
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
			</Dialog.Description>
		</Dialog.Header>
	</Dialog.Content>
</Dialog.Root>
