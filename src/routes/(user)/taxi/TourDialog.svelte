<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Card from '$lib/components/ui/card';
	import { getStyle } from '$lib/style';
	import { getRoute } from '$lib/api';
	import Map from '$lib/Map.svelte';
	import GeoJSON from '$lib/GeoJSON.svelte';
	import Layer from '$lib/Layer.svelte';
	import ArrowLeft from 'lucide-svelte/icons/arrow-left';
	import ArrowRight from 'lucide-svelte/icons/arrow-right';
	import type { TourDetails, Event } from './TourDetails';
	import maplibregl from 'maplibre-gl';
	import { Button } from '$lib/components/ui/button';

	class Props {
		open!: {
			tours: Array<TourDetails> | undefined;
		};
	}
	const { open = $bindable() }: Props = $props();

	let tourIndex = $state(0);
	let tour = $derived(open.tours && open.tours[tourIndex]);

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
			tourEvents.map((e) => e.longitude).reduce((e, c) => e + c, 0) / nEvents,
			tourEvents.map((e) => e.latitude).reduce((e, c) => e + c, 0) / nEvents
		];
	};

	const routes = $derived(tour && getRoutes(tour.events));
	const center = $derived(tour && getCenter(tour.events));

	let map = $state<undefined | maplibregl.Map>();
	let init = false;
	$effect(() => {
		if (map && !init) {
			map.addControl(new maplibregl.FullscreenControl());
			map.addControl(new maplibregl.NavigationControl(), 'bottom-left');
			init = true;
		}
	});

	const getTourInfoShort = (tour: TourDetails) => {
		let l1 = tour.events[0];
		let l2 = tour.events[tour.events.length - 1];

		if (!(l1.city && l2.city)) {
			return l1.street + ' -- ' + l2.street;
		}

		if (l1.city == l2.city) {
			return l1.city + ': ' + l1.street + ' -- ' + l2.street;
		} else {
			return l1.city + ' -- ' + l2.city;
		}
	};
</script>

<Dialog.Root
	open={tour !== undefined}
	onOpenChange={(x) => {
		if (!x) {
			open.tours = undefined;
		}
	}}
	on:close={() => history.back()}
>
	<Dialog.Content class="container max-h-screen">
		<Dialog.Header>
			<div class="flex justify-between items-center pr-4">
				<Dialog.Title>Tour Details</Dialog.Title>
				<div>
					{#if open!.tours && open.tours.length > 1}
						{#each open.tours as tour, i}
							<Button
								on:click={() => {
									tourIndex = i;
								}}
								variant={tourIndex === i ? 'default' : 'outline'}
								class="mx-2"
								>{getTourInfoShort(tour)}
							</Button>
						{/each}
					{/if}
				</div>
			</div>
		</Dialog.Header>
		<Dialog.Description>
			<div class="grid grid-rows-2 grid-cols-2 gap-4">
				{@render overview()}
				{@render mapView()}
				<div class="col-span-2">{@render details()}</div>
			</div>
		</Dialog.Description>
	</Dialog.Content>
</Dialog.Root>

{#snippet overview()}
	<Card.Root class="h-full w-full">
		<Card.Header>
			<Card.Title>Übersicht</Card.Title>
		</Card.Header>
		<Card.Content class="h-full w-full">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Abfahrt</Table.Head>
						<Table.Head>Ankunft</Table.Head>
						<Table.Head>Fahrzeug</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#if tour}
						<Table.Row>
							<Table.Cell>
								{tour!.from.toLocaleString('de-DE').slice(0, -3)}
								<br />{tour.events[0].street}<br />
								{tour.events[0].postal_code}
								{tour.events[0].city}
							</Table.Cell>
							<Table.Cell>
								{tour!.to.toLocaleString('de-DE').slice(0, -3)}
								<br />{tour.events[tour.events.length - 1].street}<br />
								{tour.events[tour.events.length - 1].postal_code}
								{tour.events[tour.events.length - 1].city}
							</Table.Cell>
							<Table.Cell>{tour!.license_plate}</Table.Cell>
						</Table.Row>
					{/if}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
{/snippet}

{#snippet mapView()}
	{#if center && routes != null}
		<Map
			bind:map
			transformRequest={(url) => {
				if (url.startsWith('/')) {
					return { url: `https://europe.motis-project.de/tiles${url}` };
				}
			}}
			style={getStyle(0)}
			{center}
			zoom={11}
			className="h-full w-full rounded-lg border shadow"
		>
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
		</Map>
	{/if}
{/snippet}

{#snippet details()}
	<Card.Root class="max-h-80 overflow-y-auto">
		<Card.Header>
			<Card.Title>Tour Details</Card.Title>
			<Card.Description>Wegpunkte, Abfahrtszeiten und Kundeninformationen</Card.Description>
		</Card.Header>
		<Card.Content class="mx-4 mb-6">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Abfahrt</Table.Head>
						<Table.Head>Straße</Table.Head>
						<Table.Head>Hausnr.</Table.Head>
						<Table.Head>Ort</Table.Head>
						<Table.Head>Kunde</Table.Head>
						<Table.Head>Tel. Kunde</Table.Head>
						<Table.Head>Ein-/Ausstieg</Table.Head>
						<Table.Head class="text-right">Fahrpreis</Table.Head>
					</Table.Row>
				</Table.Header>

				<Table.Body>
					{#if tour!.events != null}
						{#each tour!.events as event}
							<Table.Row>
								<Table.Cell>
									{event.scheduled_time.toLocaleString('de-DE').slice(0, -3).replace(',', ' ')}
								</Table.Cell>
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
									<Table.Cell class="text-green-500">
										<ArrowRight class="h-4 w-4" />
									</Table.Cell>
								{:else}
									<Table.Cell class="text-red-500">
										<ArrowLeft class="h-4 w-4" />
									</Table.Cell>
								{/if}
								<Table.Cell class="text-right">19,80</Table.Cell>
							</Table.Row>
						{/each}
					{/if}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
{/snippet}
