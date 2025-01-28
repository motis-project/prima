<script lang="ts">
	import { Input } from '$lib/shadcn/input';
	import { Label } from '$lib/shadcn/label/index.js';
	import { Button, buttonVariants } from '$lib/shadcn/button';
	import { cn } from '$lib/shadcn/utils.js';
	import ChevronDown from 'lucide-svelte/icons/chevron-down';
	import Panel from '$lib/ui/Panel.svelte';
	import AddressTypeahead from '$lib/ui/AddressTypeahead.svelte';
	import { type Location } from '$lib/ui/AddressTypeahead.svelte';

	import maplibregl from 'maplibre-gl';
	import { getStyle } from '$lib/map/style';
	import Map from '$lib/map/Map.svelte';
	import { MOTIS_BASE_URL } from '$lib/constants.js';

	const { data, form } = $props();

	console.log(data.company);
	let center = $state<[number, number]>([
		data.company.longitude ?? 14.664324861365413,
		data.company.latitude ?? 51.19750601369781
	]);
	let companyAddress = $state<Location>({
		label: data.company.address ?? '',
		value: {
			match: {
				type: 'ADDRESS',
				lat: center[1],
				lon: center[0],
				tokens: [],
				name: data.company.address ?? '',
				id: '',
				areas: [],
				score: 0.0
			}
		}
	});
	let zone = $state(data.company.zone);
	let map = $state<maplibregl.Map>();
	let startMarker: maplibregl.Marker | null = null;
	let init = false;
	$effect(() => {
		if (map && !init) {
			startMarker = new maplibregl.Marker({ draggable: true, color: 'green' })
				.setLngLat([companyAddress.value!.match!.lon, companyAddress.value!.match!.lat])
				.addTo(map)
				.on('dragend', async () => {
					const x = startMarker!.getLngLat();
					companyAddress.value!.match!.lon = x.lng;
					companyAddress.value!.match!.lat = x.lat;
				});
			init = true;
		}
	});

	$effect(() => {
		if (map && startMarker) {
			const coord: [number, number] = [
				companyAddress.value!.match!.lon,
				companyAddress.value!.match!.lat
			];
			startMarker.setLngLat(coord);
			const box = new maplibregl.LngLatBounds(coord, coord);
			const padding = {
				top: Math.max(window.innerHeight / 2, 400),
				right: 96,
				bottom: 96,
				left: 96
			};
			map.flyTo({ ...map.cameraForBounds(box), padding });
		}
	});
</script>

<Panel
	title="Stammdaten Ihres Unternehmens"
	subtitle="Angaben zu Unternehmenssitz und Pflichtfahrgebiet"
>
	<div
		class="grid grid-cols-1 grid-rows-2 gap-4 md:w-[96ch] md:grid-cols-2 md:grid-rows-1 md:flex-row"
	>
		<form method="POST">
			<div class="flex flex-col gap-6" id="searchmask-container">
				<div>
					<Label for="name">Name</Label>
					<Input name="name" id="name" value={data.company.name} />
				</div>
				<div>
					<Label for="address">Unternehmenssitz</Label>
					<AddressTypeahead placeholder={'Unternehmenssitz'} bind:selected={companyAddress} />
				</div>
				<div>
					<Label for="zone">Pflichtfahrgebiet</Label>
					<div class="relative w-full">
						<select
							name="zone"
							id="zone"
							class={cn(
								buttonVariants({ variant: 'outline' }),
								'w-full appearance-none font-normal'
							)}
						>
							<option id="zone" selected={!zone} disabled>Pflichtfahrgebiet</option>
							{#each data.zones as z}
								<option id="zone" value={z.id} selected={zone == z.id}>
									{z.name.toString()}
								</option>
							{/each}
						</select>
						<ChevronDown class="absolute right-3 top-2.5 size-4 opacity-50" />
					</div>
				</div>
			</div>
			<div class="mt-8 w-full text-right">
				<Button type="submit">Übernehmen</Button>
			</div>
		</form>

		<Map
			bind:map
			{center}
			transformRequest={(url) => {
				if (url.startsWith('/')) {
					return { url: `${MOTIS_BASE_URL}/tiles${url}` };
				}
			}}
			style={getStyle('light', 0)}
			zoom={11}
			class="order-first h-full w-full rounded-lg border shadow md:order-last"
			attribution={"&copy; <a href='http://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a>"}
		></Map>
	</div>
</Panel>
