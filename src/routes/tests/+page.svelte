<script lang="ts">
	import { v4 as uuidv4 } from 'uuid';
	import maplibregl from 'maplibre-gl';
	import pkg from 'maplibre-gl';
	import { getStyle } from '$lib/map/style.js';
	import Map from '$lib/map/Map.svelte';
	import GeoJSON from '$lib/map/GeoJSON.svelte';
	import Layer from '$lib/map/Layer.svelte';
	import { PUBLIC_MOTIS_URL } from '$env/static/public';
	import { Button } from '$lib/shadcn/button/index.js';
	import { DAY, HOUR, MINUTE } from '$lib/util/time.js';
	import Switch from '$lib/shadcn/switch/switch.svelte';
	import { Label } from '$lib/shadcn/label/index.js';
	import type { Coordinates } from '$lib/util/Coordinates.js';
	import type { Condition, TestParams } from '$lib/util/booking/testParams.js';
	import SortableTable from '$lib/ui/SortableTable.svelte';
	import type { Column } from '$lib/ui/tableData.js';
	const { Popup } = pkg;

	const { data } = $props();

	let time = $state(new Date(Date.now() + DAY * 3));
	let addCompany = $state(true);
	let departure = $state(true);

	let map = $state<maplibregl.Map>();

	let starts: { lat: number; lng: number }[] = $state([]);
	let destinations: { lat: number; lng: number }[] = $state([]);
	let companies: { lat: number; lng: number }[] = $state([]);

	let init = false;
	let startMarkers: maplibregl.Marker[] = [];
	let destinationMarkers: maplibregl.Marker[] = [];
	let companyMarkers: maplibregl.Marker[] = [];
	let times: number[] = [];
	let isDepartures: boolean[] = [];

	function addTime(t: number) {
		time = new Date(time.getTime() + t);
	}

	function addMarkers(
		markers: maplibregl.Marker[],
		coordinates: { lat: number; lng: number }[],
		color: string,
		onDropNearCompany?: (start: number, company: number) => void,
		tooltipPrefix?: (string | undefined)[]
	) {
		markers.forEach((marker) => marker.remove());
		return coordinates.map((coordinate, i) => {
			const el = document.createElement('div');
			el.className = 'marker-start';
			el.innerText = `${i + 1}`;
			Object.assign(el.style, {
				backgroundColor: color,
				color: 'black',
				width: '24px',
				height: '24px',
				borderRadius: '50%',
				textAlign: 'center',
				lineHeight: '24px',
				fontWeight: 'bold',
				fontSize: '12px'
			});
			if (tooltipPrefix && tooltipPrefix[i]) {
				const popup = new Popup({ closeButton: false, closeOnClick: false }).setText(
					`${tooltipPrefix[i]}`
				);

				el.addEventListener('mouseenter', () => {
					popup.setLngLat([coordinate.lng, coordinate.lat]).addTo(map!);
				});

				el.addEventListener('mouseleave', () => {
					popup.remove();
				});
			}
			const marker = new maplibregl.Marker({
				element: el,
				draggable: onDropNearCompany !== undefined
			})
				.setLngLat([coordinate.lng, coordinate.lat])
				.addTo(map!);
			if (onDropNearCompany !== undefined) {
				marker.on('dragend', () => {
					const dropped = marker.getLngLat();

					const threshold = 0.002;
					const foundIndex = companies.findIndex((company) => {
						const dx = dropped.lng - company.lng;
						const dy = dropped.lat - company.lat;
						return Math.sqrt(dx * dx + dy * dy) < threshold;
					});

					if (foundIndex !== -1 && destinations.length !== i) {
						onDropNearCompany(i, foundIndex);
					}
					marker.setLngLat(coordinate);
				});
			}
			return marker;
		});
	}

	let currentTestEntity = $state('-1');
	let expectedRequestCount = $state(-1);
	let expectedTourCount = $state(-1);
	let expectedPosition = $state(-1);
	let afterRequest = $state(-1);
	let selectedRequest = $state(-1);

	let conditions: Condition[] = $state([]);
	let uuid = '1';
	function addCondition() {
		uuid = uuidv4();
		console.log({ selectedRequest }, { starts });
		conditions.push({
			evalAfterStep: afterRequest,
			entity: currentTestEntity!,
			tourCount: expectedTourCount,
			requestCount: expectedRequestCount,
			expectedPosition: expectedPosition === -1 ? null : expectedPosition,
			start: starts[selectedRequest] ? starts[selectedRequest] : null,
			destination: destinations[selectedRequest] ? destinations[selectedRequest] : null,
			company: null
		});
		afterRequest = -1;
		expectedRequestCount = -1;
		expectedTourCount = -1;
		currentTestEntity = '-1';
		expectedPosition = -1;
		selectedRequest = -1;
	}

	function isAddable() {
		console.log({ expectedRequestCount });
		switch (currentTestEntity) {
			case 'requestCount':
				if (expectedRequestCount === -1) {
					return false;
				}
				break;
			case 'tourCount':
				if (expectedTourCount === -1) {
					return false;
				}
				break;
			case 'startPosition':
				if (selectedRequest === -1 || expectedPosition === -1) {
					return false;
				}
				break;
			case 'destinationPosition':
				if (selectedRequest === -1 || expectedPosition === -1) {
					return false;
				}
				break;
		}
		return true;
	}

	function assignRequestToCompany(startIdx: number, start: Coordinates, company: Coordinates) {
		uuid = uuidv4();
		conditions.push({
			evalAfterStep: startIdx,
			entity: 'requestCompanyMatch',
			start,
			destination: destinations[startIdx],
			company,
			expectedPosition: null,
			tourCount: null,
			requestCount: null
		});
	}

	$effect(() => {
		if (!map) return;
		companyMarkers = addMarkers(companyMarkers, companies, 'yellow');
		startMarkers = addMarkers(
			startMarkers,
			starts,
			'green',
			(s, c) => assignRequestToCompany(s, starts[s], companies[c]),
			isDepartures.map((dep, i) => (dep ? new Date(times[i]).toISOString() : undefined))
		);
		destinationMarkers = addMarkers(
			destinationMarkers,
			destinations,
			'red',
			undefined,
			isDepartures.map((dep, i) => (!dep ? new Date(times[i]).toISOString() : undefined))
		);
	});

	$effect(() => {
		if (map && !init) {
			map.on('contextmenu', (e) => {
				const { lat, lng } = e.lngLat;
				if (addCompany) {
					companies.push({ lat, lng });
				} else {
					if (starts.length === destinations.length) {
						starts.push({ lat, lng });
					} else {
						destinations.push({ lat, lng });
						times.push(time.getTime());
						isDepartures.push(departure);
					}
				}
			});
			init = true;
		}
	});

	let json: string = $derived(
		JSON.stringify(
			{
				conditions,
				process: { starts, destinations, times, isDepartures, companies },
				uuid
			},
			null,
			'\t'
		)
	);

	function readTest(inputJson: string | null) {
		if (inputJson === null) {
			return;
		}
		const test: TestParams = eval('(' + inputJson.trim().replace(/},\s*$/, '}') + ')');
		companies.length = 0;
		test.process.companies.forEach((i) => companies.push(i));
		starts.length = 0;
		test.process.starts.forEach((i) => starts.push(i));
		destinations.length = 0;
		test.process.destinations.forEach((i) => destinations.push(i));
		times.length = 0;
		test.process.times.forEach((i) => times.push(i));
		isDepartures.length = 0;
		test.process.isDepartures.forEach((i) => isDepartures.push(i));
		conditions.length = 0;
		test.conditions.forEach((i) => conditions.push(i));
	}
	readTest(data.test);

	function conditionToString(c: Condition): string {
		let str = '';
		switch (c.entity) {
			case 'requestCount':
				str = `Verify that there are exactly ${c.requestCount} requests.`;
				break;
			case 'tourCount':
				str = `Verify that there are exactly ${c.tourCount} tours.`;
				break;
			case 'startPosition':
				str = `Verify that pickup event of request with #${starts.findIndex((s) => s.lat === c.start?.lat && s.lng === c.start?.lng) + 1} is at position ${c.expectedPosition} of its' tour.`;
				break;
			case 'destinationPosition':
				str = `Verify that dropoff event of request with #${destinations.findIndex((s) => s.lat === c.destination?.lat && s.lng === c.destination?.lng) + 1} is at position ${c.expectedPosition} of its' tour.`;
				break;
			case 'requestCompanyMatch':
				str = `Verify that request #${starts.findIndex((s) => s.lat === c.start?.lat && s.lng === c.start?.lng) + 1} is assigned to company with ${companies.findIndex((company) => company.lat === c.company?.lat && company.lng === c.company?.lng) + 1}.`;
				break;
		}
		return str;
	}

	const conditionCols: Column<Condition>[] = [
		{
			text: ['after Request'],
			toTableEntry: (r: Condition) => r.evalAfterStep + 1
		},
		{
			text: ['condition'],
			toTableEntry: (r: Condition) => conditionToString(r)
		}
	];
</script>

<div class="flex h-full w-screen">
	<div class="h-full w-1/2">
		<Map
			bind:map
			transformRequest={(url, _resourceType) => {
				if (url.startsWith('/')) {
					return { url: `${PUBLIC_MOTIS_URL}/tiles${url}` };
				}
			}}
			center={[14.5771254, 51.5269344]}
			zoom={10}
			style={getStyle('light', 0)}
			class="h-full w-full rounded-lg border shadow"
			attribution={"&copy; <a href='http://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a>"}
		>
			<GeoJSON id="route" data={data.areas as GeoJSON.GeoJSON}>
				<Layer
					id="areas"
					type="fill"
					layout={{}}
					filter={['literal', true]}
					paint={{
						'fill-color': '#088',
						'fill-opacity': 0.4,
						'fill-outline-color': '#000'
					}}
				/>
				<Layer
					id="areas-outline"
					type="line"
					layout={{}}
					filter={['literal', true]}
					paint={{
						'line-color': '#000',
						'line-width': 2
					}}
				/>
				<Layer
					id="areas-labels"
					type="symbol"
					layout={{
						'symbol-placement': 'point',
						'text-field': ['get', 'name'],
						'text-font': ['Noto Sans Display Regular'],
						'text-size': 16
					}}
					filter={['literal', true]}
					paint={{
						'text-halo-width': 12,
						'text-halo-color': '#fff',
						'text-color': '#f00'
					}}
				/>
			</GeoJSON>
		</Map>
	</div>
	<div class="h-full w-1/2 flex-col overflow-auto border-l border-gray-300 p-4">
		<div class="mt-4 flex gap-4">
			<Switch class="justify-self-end" bind:checked={addCompany} />
			<Label class="flex items-center gap-2">Add Company</Label>

			<Switch class="justify-self-end" bind:checked={departure} />
			<Label class="flex items-center gap-2">Time fixed at start</Label>

			<form method="POST" action="?/addTest">
				<input type="hidden" name="value" value={json} />
				<Button type="submit" name="intent">Add Test</Button>
			</form>
		</div>

		<div class="mt-4 flex gap-4">
			{time.toISOString().slice(0, time.toISOString().lastIndexOf('.')).replaceAll('T', ' ')}
			<Button onclick={() => addTime(MINUTE)}>+1m</Button>
			<Button onclick={() => addTime(5 * MINUTE)}>+5m</Button>
			<Button onclick={() => addTime(HOUR)}>+1h</Button>
			<Button onclick={() => addTime(-MINUTE)}>-1m</Button>
			<Button onclick={() => addTime(-5 * MINUTE)}>-5m</Button>
			<Button onclick={() => addTime(-HOUR)}>-1h</Button>
		</div>

		<div class="mt-4 flex gap-4">
			<select bind:value={afterRequest} class="rounded border border-gray-300 bg-white px-3 py-2">
				<option value={-1} disabled>After Request #</option>
				{#each destinations.entries() as [i, _]}
					<option value={i}>{i + 1}</option>
				{/each}
			</select>

			<select
				bind:value={currentTestEntity}
				class="rounded border border-gray-300 bg-white px-3 py-2"
			>
				<option value="-1" disabled>Select test type</option>
				<option value="requestCount">requestCount</option>
				<option value="tourCount">tourCount</option>
				<option value="startPosition">startPosition</option>
				<option value="destinationPosition">destinationPosition</option>
			</select>

			{#if currentTestEntity === 'requestCount'}
				<select
					bind:value={expectedRequestCount}
					class="rounded border border-gray-300 bg-white px-3 py-2"
				>
					<option value={-1} disabled>request Count</option>
					<option value={0}>0</option>
					{#each destinations.entries() as [i, _]}
						<option value={i + 1}>{i + 1}</option>
					{/each}
				</select>
			{/if}

			{#if currentTestEntity === 'tourCount'}
				<select
					bind:value={expectedTourCount}
					class="rounded border border-gray-300 bg-white px-3 py-2"
				>
					<option value={-1} disabled>tour Count</option>
					<option value={0}>0</option>
					{#each destinations.entries() as [i, _]}
						<option value={i + 1}>{i + 1}</option>
					{/each}
				</select>
			{/if}

			{#if currentTestEntity === 'startPosition' || currentTestEntity === 'destinationPosition'}
				<select
					bind:value={expectedPosition}
					class="rounded border border-gray-300 bg-white px-3 py-2"
				>
					<option value={-1} disabled>Select position</option>
					{#each Array(2 * destinations.length) as _, i}
						<option value={i}>{i}</option>
					{/each}
				</select>
				<select
					bind:value={selectedRequest}
					class="rounded border border-gray-300 bg-white px-3 py-2"
				>
					<option value={-1} disabled>Select request</option>
					{#each destinations.entries() as [i, _]}
						<option value={i}>{i}</option>
					{/each}
				</select>
			{/if}
			{#if currentTestEntity !== '-1' && afterRequest !== -1 && isAddable()}
				<Button onclick={addCondition}>Add Condition</Button>
			{/if}
		</div>

		<SortableTable rows={conditions} cols={conditionCols}></SortableTable>
	</div>
</div>
