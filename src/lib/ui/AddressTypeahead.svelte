<script lang="ts">
	import Bus from 'lucide-svelte/icons/bus-front';
	import House from 'lucide-svelte/icons/map-pin-house';
	import Place from 'lucide-svelte/icons/map-pin';

	import { Combobox } from 'bits-ui';
	import { geocode, type Match } from '$lib/openapi';
	import { language } from '$lib/i18n/translation';
	import maplibregl from 'maplibre-gl';
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n/translation';
	import type { Column } from './tableData';
	import SortableTable from './SortableTable.svelte';
	import * as Card from '$lib/shadcn/card';

	export type Location = {
		label?: string;
		value: {
			match?: Match;
			precision?: number;
		};
	};

	export function posToLocation(pos: maplibregl.LngLatLike, level: number): Location {
		const { lat, lng } = maplibregl.LngLat.convert(pos);
		const label = `${lat},${lng},${level}`;
		return {
			label,
			value: {
				match: {
					lat,
					lon: lng,
					level,
					id: '',
					areas: [],
					type: 'PLACE',
					name: label,
					tokens: [],
					score: 0
				},
				precision: 100
			}
		};
	}

	const COORD_LVL_REGEX = /^([+-]?\d+(\.\d+)?)\s*,\s*([+-]?\d+(\.\d+)?)\s*,\s*([+-]?\d+(\.\d+)?)$/;
	const COORD_REGEX = /^([+-]?\d+(\.\d+)?)\s*,\s*([+-]?\d+(\.\d+)?)$/;

	let {
		items = $bindable([]),
		selected = $bindable(),
		onValueChange,
		placeholder,
		name,
		favs,
		selectedFav = $bindable()
	}: {
		items?: Array<Location>;
		selected?: Location;
		onValueChange?: (m: Location) => void;
		placeholder?: string;
		name?: string;
		favs?: { address: string; lat: number; lng: number }[];
		selectedFav?: { address: string; lat: number; lng: number }[];
	} = $props();

	let favRows = $derived(favs);

	const favsCols: Column<{ address: string; lat: number; lng: number }>[] = [
		{
			text: [t.favourites],
			sort: undefined,
			toTableEntry: (r: { address: string }) => r.address
		}
	];

	let inputValue = $state('');
	let value = $state('');

	const getDisplayArea = (match: Match | undefined) => {
		if (match) {
			const matchedArea = match.areas.find((a) => a.matched);
			const defaultArea = match.areas.find((a) => a.default);
			if (matchedArea?.name.match(/^[0-9]*$/)) {
				matchedArea.name += ' ' + defaultArea?.name;
			}
			let area = (matchedArea ?? defaultArea)?.name;
			if (area == match.name) {
				area = match.areas[0]!.name;
			}
			return area;
		}
		return '';
	};

	const getLabel = (match: Match) => {
		const displayArea = getDisplayArea(match);
		return displayArea ? match.name + ', ' + displayArea : match.name;
	};

	const updateGuesses = async () => {
		const coordinateWithLevel = inputValue.match(COORD_LVL_REGEX);
		if (coordinateWithLevel) {
			selected = posToLocation(
				[Number(coordinateWithLevel[3]), Number(coordinateWithLevel[1])],
				Number(coordinateWithLevel[5])
			);
			items = [];
			return;
		}

		const coordinate = inputValue.match(COORD_REGEX);
		if (coordinate) {
			selected = posToLocation([Number(coordinate[3]), Number(coordinate[1])], 0);
			items = [];
			return;
		}

		const { data: matches, error } = await geocode({
			query: { text: inputValue, language }
		});
		if (error) {
			console.error('TYPEAHEAD ERROR: ', error);
			return;
		}
		items = matches!.map((match: Match): Location => {
			return {
				label: getLabel(match),
				value: { match }
			};
		});
		const shown = new Set<string>();
		items = items.filter((x) => {
			const entry = x.value.match?.type + x.label!;
			if (shown.has(entry)) {
				return false;
			}
			shown.add(entry);
			return true;
		});
	};

	const deserialize = (s: string): Location => {
		const x = JSON.parse(s);
		return {
			value: x,
			label: getLabel(x.match)
		};
	};

	$effect(() => {
		if (selected) {
			value = JSON.stringify(selected.value);
			inputValue = selected.label!;
		}
	});

	let ref = $state<HTMLElement | null>(null);
	$effect(() => {
		if (ref && inputValue) {
			(ref as HTMLInputElement).value = inputValue;
		}
	});

	let timer: ReturnType<typeof setTimeout> = setTimeout(() => {});
	$effect(() => {
		if (inputValue) {
			clearTimeout(timer);
			timer = setTimeout(() => {
				updateGuesses();
			}, 150);
		}
	});

	onMount(() => ref?.focus());
</script>

{#snippet favourites()}
	{#if favRows != undefined && favRows.length != 0}
		<Card.Root class="mt-5">
			<Card.Header>
				<Card.Title>{t.favourites}</Card.Title>
			</Card.Header>
			<Card.Content>
				<SortableTable
					getRowStyle={(_) => 'cursor-pointer '}
					rows={favRows}
					cols={favsCols}
					bind:selectedRow={selectedFav}
					bindSelectedRow={true}
				/>
			</Card.Content></Card.Root
		>
	{/if}
{/snippet}

<Combobox.Root
	type="single"
	allowDeselect={false}
	{value}
	onValueChange={(e: string) => {
		if (e) {
			selected = deserialize(e);
			inputValue = selected.label!;
			if (onValueChange) {
				onValueChange(selected);
			}
		}
	}}
>
	<Combobox.Input
		{placeholder}
		{name}
		bind:ref
		class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
		autocomplete="off"
		oninput={(e) => (inputValue = e.currentTarget.value)}
		aria-label={placeholder}
		data-combobox-input={inputValue}
	/>
	{#if items.length !== 0}
		<Combobox.Portal>
			<Combobox.Content
				align="start"
				class="absolute top-2 z-10 w-[var(--bits-combobox-anchor-width)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md outline-none"
			>
				{#each items as item (item.value)}
					<Combobox.Item
						class="flex w-full cursor-default select-none items-center rounded-sm py-4 pl-4 pr-2 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50"
						value={JSON.stringify(item.value)}
						label={item.label}
					>
						{#if item.value.match?.type == 'STOP'}
							<Bus />
						{:else if item.value.match?.type == 'ADDRESS'}
							<House />
						{:else if item.value.match?.type == 'PLACE'}
							<Place />
						{/if}
						<span class="ml-4 overflow-hidden text-ellipsis text-nowrap font-semibold">
							{item.value.match?.name}
						</span>
						<span class="ml-2 overflow-hidden text-ellipsis text-nowrap text-muted-foreground">
							{getDisplayArea(item.value.match)}
						</span>
					</Combobox.Item>
				{/each}
			</Combobox.Content>
		</Combobox.Portal>
	{/if}
</Combobox.Root>
{@render favourites()}
