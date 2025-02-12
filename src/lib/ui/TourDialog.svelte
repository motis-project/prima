<script lang="ts">
	import ArrowLeft from 'lucide-svelte/icons/arrow-left';
	import ArrowRight from 'lucide-svelte/icons/arrow-right';

	import { Button } from '$lib/shadcn/button';
	import * as Dialog from '$lib/shadcn/dialog';
	import * as Table from '$lib/shadcn/table';
	import * as Card from '$lib/shadcn/card';

	import maplibregl from 'maplibre-gl';
	import { getStyle } from '$lib/map/style';
	import Map from '$lib/map/Map.svelte';
	import GeoJSON from '$lib/map/GeoJSON.svelte';
	import Layer from '$lib/map/Layer.svelte';

	import type { TourEvent, Tours } from '$lib/server/db/getTours';
	import type { PlanResponse } from '$lib/openapi';
	import { MIN_PREP } from '$lib/constants';
	import { carRouting } from '$lib/util/carRouting';
	import { polylineToGeoJSON } from '$lib/util/polylineToGeoJSON';
	import { getTourInfoShort } from '$lib/util/getTourInfoShort';
	import { getScheduledEventTime } from '$lib/util/getScheduledEventTime';
	import { PUBLIC_MOTIS_URL } from '$env/static/public';

	const {
		open = $bindable()
	}: {
		open: { tours: Tours | undefined };
	} = $props();

	const displayFare = (fare: number | null) => {
		if (!fare) {
			return '-';
		}
		let res: string = Math.floor(fare / 100) + ',' + (fare % 100);
		return res;
	};

	let tourIndex = $state(0);
	let tour = $derived(open.tours && open.tours[tourIndex]);

	const getRoutes = (tourEvents: Array<TourEvent> | null): Promise<PlanResponse>[] => {
		let routes: Array<Promise<PlanResponse>> = [];
		if (tourEvents == null || tourEvents!.length == 0) {
			return routes;
		}
		for (let e = 0; e < tourEvents!.length - 1; e++) {
			let e1 = tourEvents![e];
			let e2 = tourEvents![e + 1];
			routes.push(carRouting(e1, e2));
		}
		return routes;
	};

	const getCenter = (tourEvents: Array<TourEvent>): [number, number] => {
		return [
			tourEvents.map((e) => e.lng).reduce((e, c) => e + c, 0) / tourEvents.length,
			tourEvents.map((e) => e.lat).reduce((e, c) => e + c, 0) / tourEvents.length
		];
	};

	const routes = $derived(tour && tour.events.length !== 0 && getRoutes(tour.events));
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

	const threshold = new Date();
	threshold.setMinutes(threshold.getMinutes() + MIN_PREP);
</script>

<Dialog.Root
	open={tour !== undefined}
	onOpenChange={(x) => {
		if (!x) {
			open.tours = undefined;
		}
	}}
>
	<Dialog.Content class="container max-h-screen">
		<Dialog.Header>
			<div class="flex items-center justify-between pr-4">
				<Dialog.Title>Tour Details</Dialog.Title>
				<div>
					{#if open!.tours && open.tours.length > 1}
						{#each open.tours as tour, i}
							{@const tourInfo = getTourInfoShort(tour)}
							<Button
								onclick={() => {
									tourIndex = i;
								}}
								variant={tourIndex === i ? 'default' : 'outline'}
								class="mx-2"
							>
								{tourInfo.from} - {tourInfo.to}
							</Button>
						{/each}
					{/if}
				</div>
			</div>
		</Dialog.Header>
		<Dialog.Description>
			<div class="grid grid-cols-2 grid-rows-2 gap-4">
				{@render overview()}
				{@render mapView()}
				<div class="col-span-2">{@render details()}</div>
			</div>
		</Dialog.Description>
	</Dialog.Content>
</Dialog.Root>

{#snippet overview()}
	<Card.Root>
		<Card.Header>
			<Card.Title>Übersicht</Card.Title>
		</Card.Header>
		<Card.Content>
			<div class="grid grid-flow-row grid-cols-2 flex-col gap-2">
				{#if tour}
					<div class="rounded bg-primary-foreground p-2">Startzeit</div>
					<div class="rounded bg-primary-foreground p-2 text-right">
						{new Date(tour!.startTime).toLocaleString('de-DE').slice(0, -3)}
					</div>

					<div class="rounded bg-primary-foreground p-2">Endzeit</div>
					<div class="rounded bg-primary-foreground p-2 text-right">
						{new Date(tour!.endTime).toLocaleString('de-DE').slice(0, -3)}
					</div>

					<div class="rounded bg-primary-foreground p-2">Kennzeichen</div>
					<div class="rounded bg-primary-foreground p-2 text-right">{tour!.licensePlate}</div>

					<div class="rounded bg-primary-foreground p-2">Preis</div>
					<div class="rounded bg-primary-foreground p-2 text-right">
						{displayFare(tour!.fare)} €
					</div>
				{/if}
			</div>
		</Card.Content>
	</Card.Root>
{/snippet}

{#snippet mapView()}
	{#if center && routes}
		<Map
			bind:map
			{center}
			transformRequest={(url) => {
				if (url.startsWith('/')) {
					return { url: `${PUBLIC_MOTIS_URL}/tiles${url}` };
				}
			}}
			style={getStyle('light', 0)}
			zoom={11}
			class="h-full w-full rounded-lg border shadow"
			attribution={"&copy; <a href='http://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a>"}
		>
			{#each routes as segment, i}
				{#await segment then r}
					{#if r.direct.length != 0 && r.direct[0] != undefined}
						{#each r.direct[0].legs as leg}
							<GeoJSON id={'r_ ' + i} data={polylineToGeoJSON(leg.legGeometry.points)}>
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
						{/each}
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
		<Card.Content>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Abfahrt</Table.Head>
						<Table.Head>Addresse</Table.Head>
						<Table.Head>Kunde</Table.Head>
						<Table.Head>Tel. Kunde</Table.Head>
						<Table.Head>Ein-/Ausstieg</Table.Head>
					</Table.Row>
				</Table.Header>

				<Table.Body>
					{#if tour?.events}
						{#each tour!.events as event}
							<Table.Row>
								<Table.Cell>
									{new Date(getScheduledEventTime(event))
										.toLocaleString('de-DE')
										.slice(0, -3)
										.replace(',', ' ')}
								</Table.Cell>
								<Table.Cell>{event.address}</Table.Cell>
								<Table.Cell>
									{event.customerName}
								</Table.Cell>
								<Table.Cell>
									{event.customerPhone}
								</Table.Cell>
								{#if event.isPickup}
									<Table.Cell class="text-green-500">
										<ArrowRight class="h-4 w-4" />
									</Table.Cell>
								{:else}
									<Table.Cell class="text-red-500">
										<ArrowLeft class="h-4 w-4" />
									</Table.Cell>
								{/if}
							</Table.Row>
						{/each}
					{/if}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
{/snippet}
