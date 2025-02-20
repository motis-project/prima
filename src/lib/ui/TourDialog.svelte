<script lang="ts">
	import ArrowLeft from 'lucide-svelte/icons/arrow-left';
	import ArrowRight from 'lucide-svelte/icons/arrow-right';
	import LuggageIcon from 'lucide-svelte/icons/luggage';
	import WheelchairIcon from 'lucide-svelte/icons/accessibility';
	import PersonIcon from 'lucide-svelte/icons/user';

	import { Button } from '$lib/shadcn/button';
	import * as Dialog from '$lib/shadcn/dialog';
	import * as Table from '$lib/shadcn/table';
	import * as Card from '$lib/shadcn/card';

	import maplibregl from 'maplibre-gl';
	import { getStyle } from '$lib/map/style';
	import Map from '$lib/map/Map.svelte';
	import GeoJSON from '$lib/map/GeoJSON.svelte';
	import Layer from '$lib/map/Layer.svelte';

	import type { Tours } from '$lib/server/db/getTours';
	import type { PlanResponse } from '$lib/openapi';
	import { MIN_PREP } from '$lib/constants';
	import { carRouting } from '$lib/util/carRouting';
	import { polylineToGeoJSON } from '$lib/util/polylineToGeoJSON';
	import { getTourInfoShort } from '$lib/util/getTourInfoShort';
	import { getScheduledEventTime } from '$lib/util/getScheduledEventTime';
	import { PUBLIC_MOTIS_URL } from '$env/static/public';
	import CancelMessageDialog from './CancelMessageDialog.svelte';

	const {
		open = $bindable()
	}: {
		open: {
			tours: Tours | undefined;
			isAdmin: boolean;
		};
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
	let company = $derived(tour && { lat: tour.companyLat!, lng: tour.companyLng! });

	const getRoutes = (): Promise<PlanResponse>[] => {
		let routes: Array<Promise<PlanResponse>> = [];
		if (tour == null || company == null || tour.events.length == 0) {
			return routes;
		}
		for (let e = 0; e < tour.events.length - 1; e++) {
			const e1 = tour.events[e];
			const e2 = tour.events[e + 1];
			routes.push(carRouting(e1, e2));
		}
		return routes;
	};

	const routes = $derived(tour && getRoutes());
	const fromCompany = $derived(tour && company && carRouting(company, tour.events[0]));
	const toCompany = $derived(
		tour && company && carRouting(tour.events[tour.events.length - 1], company)
	);

	$effect(() => {
		if (map && tour) {
			const box = new maplibregl.LngLatBounds(company, company);
			tour.events.forEach((e) => box.extend(e));
			const padding = {
				top: 64,
				right: 64,
				bottom: 64,
				left: 64
			};
			map.flyTo({ ...map.cameraForBounds(box), padding, zoom: 10 });
		}
	});

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
				{#if tour?.message != null}
					<div class="col-span-2">{@render message()}</div>
				{/if}
			</div>
		</Dialog.Description>
	</Dialog.Content>
</Dialog.Root>

{#snippet overview()}
	<Card.Root>
		<Card.Header>
			<div class="flex w-full items-center justify-between">
				<Card.Title>Übersicht</Card.Title>
				{#if tour && !tour.cancelled && !open.isAdmin && tour.endTime > Date.now()}
					<CancelMessageDialog bind:tour={open.tours![tourIndex]} />
				{/if}
			</div>
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

{#snippet drawRoutes(
	routes: Array<Promise<PlanResponse>>,
	name: string,
	color: string,
	outlineColor: string
)}
	{#each routes as segment, i}
		{#await segment then r}
			{#if r.direct.length != 0 && r.direct[0] != undefined}
				{#each r.direct[0].legs as leg}
					<GeoJSON id={name + '-r_ ' + i} data={polylineToGeoJSON(leg.legGeometry.points)}>
						<Layer
							id={name + '-path-outline_' + i}
							type="line"
							layout={{
								'line-join': 'round',
								'line-cap': 'round'
							}}
							filter={true}
							paint={{
								'line-color': outlineColor,
								'line-width': 7.5,
								'line-opacity': 0.5
							}}
						/>
						<Layer
							id={name + '-path_' + i}
							type="line"
							layout={{
								'line-join': 'round',
								'line-cap': 'round'
							}}
							filter={true}
							paint={{
								'line-color': color,
								'line-width': 5,
								'line-opacity': 0.5
							}}
						/>
					</GeoJSON>
				{/each}
			{/if}
		{/await}
	{/each}
{/snippet}

{#snippet mapView()}
	{#if company && routes && fromCompany && toCompany}
		<Map
			bind:map
			center={company}
			transformRequest={(url) => {
				if (url.startsWith('/')) {
					return { url: `${PUBLIC_MOTIS_URL}/tiles${url}` };
				}
			}}
			style={getStyle('light', 0)}
			zoom={10}
			class="h-full w-full rounded-lg border shadow"
			attribution={"&copy; <a href='http://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a>"}
		>
			{@render drawRoutes([fromCompany], 'outward', '#ff0000', '#000000')}
			{@render drawRoutes([toCompany], 'return', '#00ff00', '#000000')}
			{@render drawRoutes(routes, 'events', '#0000ff', '#000000')}
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
							<Table.Row class={`${tour.cancelled ? 'bg-red-500' : 'bg-primary-background'}`}>
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
									<Table.Cell class="flex gap-2 text-green-500">
										<ArrowRight class="size-4" />
										{#if event.wheelchairs}
											<WheelchairIcon class="size-4" />
										{/if}
										<span class="flex">
											<PersonIcon class="size-4" />
											{event.passengers}
										</span>
										<span class="flex">
											{#if event.luggage === 1}
												<LuggageIcon class="size-4" />
											{:else if event.luggage === 3}
												<LuggageIcon class="size-4" />
												<LuggageIcon class="size-4" />
											{/if}
										</span>
									</Table.Cell>
								{:else}
									<Table.Cell class="flex items-center gap-2 text-red-500">
										<ArrowLeft class="size-4" />
										{#if event.wheelchairs}
											<WheelchairIcon class="size-4" />
										{/if}
										<span class="flex items-center">
											<PersonIcon class="size-4" />
											{event.passengers}
										</span>
										<span class="flex items-center">
											{#if event.luggage === 1}
												<LuggageIcon class="size-4" />
											{:else if event.luggage === 3}
												<LuggageIcon class="size-4" />
												<LuggageIcon class="size-4" />
											{/if}
										</span>
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

{#snippet message()}
	<Card.Root class="max-h-80 overflow-y-auto">
		<Card.Header>
			<Card.Title>Stornierungsnachricht</Card.Title>
		</Card.Header>
		<Card.Content>
			<div class="bg-primary-foreground">
				{tour!.message}
			</div>
		</Card.Content>
	</Card.Root>
{/snippet}
