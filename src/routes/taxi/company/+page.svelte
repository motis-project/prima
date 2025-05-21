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
	import Message from '$lib/ui/Message.svelte';
	import { env } from '$env/dynamic/public';

	const { data, form } = $props();

	let center = $state<[number, number]>([
		data.company.lng ?? 14.664324861365413,
		data.company.lat ?? 51.19750601369781
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
			startMarker = new maplibregl.Marker({ draggable: true, color: 'green' });
			startMarker
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
				top: 16,
				right: 16,
				bottom: 16,
				left: 16
			};
			map.flyTo({ ...map.cameraForBounds(box), padding, zoom: 15 });
		}
	});
</script>

<Panel
	title="Stammdaten Ihres Unternehmens"
	subtitle="Angaben zu Unternehmenssitz und Pflichtfahrgebiet"
>
	<div class="grid grid-cols-1 grid-rows-2 gap-4 md:grid-cols-2 md:grid-rows-1 md:flex-row">
		<form method="POST">
			<div class="flex flex-col gap-6" id="searchmask-container">
				<Message msg={form?.msg} />
				<div>
					<Label for="name">Name</Label>
					<Input name="name" id="name" value={data.company.name} />
				</div>
				<div>
					<Label for="address">Unternehmenssitz</Label>
					<AddressTypeahead
						name="address"
						onValueChange={(l: Location) => (companyAddress = l)}
						placeholder={'Unternehmenssitz'}
						bind:selected={companyAddress}
					/>
					<input type="hidden" name="lat" value={companyAddress.value.match?.lat} />
					<input type="hidden" name="lng" value={companyAddress.value.match?.lon} />
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
					return { url: `${env.PUBLIC_MOTIS_URL}/tiles${url}` };
				}
			}}
			style={getStyle('light', 0)}
			zoom={11}
			class="order-first h-full w-full rounded-lg border shadow md:order-last"
			attribution={"&copy; <a href='http://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a>"}
		></Map>
	</div>
</Panel>
