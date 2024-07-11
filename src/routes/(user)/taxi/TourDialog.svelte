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
	import { ScrollArea } from '$lib/components/ui/scroll-area';

	class Props {
		open!: { open: boolean };
		selectedTour!: Tour | null;
		selectedTourEvents!: Array<Event> | null;
		routes!: Array<Promise<any>>;
		center!: Location | null;
	}
	const { open = $bindable(), selectedTourEvents, selectedTour, routes, center }: Props = $props();
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
	<Dialog.Content class="w-fit m-auto min-w-[1440px] h-auto">
		<Dialog.Header>
			<Dialog.Title>Tour Details</Dialog.Title>
			<Dialog.Description>
				<div class="grid grid-cols-2 grid-rows-1 py-3">
					<div class="inline-flex flex-col">
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
												{#if selectedTourEvents != null}
													{#each selectedTourEvents as event}
														<Table.Row>
															<Table.Cell
																>{event.scheduled_time
																	.toLocaleString('de-DE')
																	.slice(0, -3)}</Table.Cell
															>
															<Table.Cell>{event.street}</Table.Cell>
															<Table.Cell>{event.house_number}</Table.Cell>
															<Table.Cell>{event.postal_code} {event.city}</Table.Cell>
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
									center={[center!.lng, center!.lat]}
									zoom={10}
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
