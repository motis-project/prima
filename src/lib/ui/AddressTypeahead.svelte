<script lang="ts">
	import { Combobox } from 'bits-ui';
	import { geocode, type LocationType, type Match, type Mode } from '$lib/openapi';
	import { MapPinHouse as House, MapPin as Place } from 'lucide-svelte';
	import { parseCoordinatesToLocation, type Location } from '$lib/map/Location';
	import { language } from '$lib/i18n/translation';
	import maplibregl from 'maplibre-gl';
	import { getModeStyle, type LegLike } from './modeStyle';
	import { onMount } from 'svelte';
	import {
		clearHistoryLocations,
		getHistoryLocations,
		recordHistoryLocation
	} from '$lib/stores/history';
	import { t } from '$lib/i18n/translation';
	import { Trash2 } from 'lucide-svelte';

	let {
		items = $bindable([]),
		selected = $bindable(),
		onValueChange = () => {},
		placeholder,
		name,
		place,
		type,
		transitModes,
		open = $bindable(false),
		focus = true
	}: {
		items?: Array<Location>;
		selected?: Location;
		onValueChange?: (m: Location) => void;
		placeholder?: string;
		name?: string;
		place?: maplibregl.LngLatLike;
		type?: undefined | LocationType;
		transitModes?: Mode[];
		open?: boolean;
		focus?: boolean;
	} = $props();

	let inputValue = $state('');
	let value = $state('');

	let history = $state(getHistoryLocations());

	let inputWasNotEmpty = $state(false);
	let favTimer: ReturnType<typeof setTimeout>;

	$effect(() => {
		clearTimeout(favTimer);
		if (inputValue) {
			return;
		}
		if (inputWasNotEmpty) {
			items = history;
		}
		favTimer = setTimeout(() => {
			items = history;
		}, 200);
	});

	const showHistoryHint = $derived(!inputValue && items.length > 0);

	const getDisplayArea = (match: Match | undefined) => {
		if (match) {
			const matchedArea = match.areas.find((a) => a.matched);
			const defaultArea = match.areas.find((a) => a.default);
			if (matchedArea?.name.match(/^[0-9]*$/)) {
				matchedArea.name += ' ' + defaultArea?.name;
			}

			const areas = new Set<number>();

			match.areas.forEach((a, i) => {
				if (a.matched || a.unique || a.default || a.adminLevel == 4) {
					if (a.name != match.name) {
						areas.add(i);
					}
				}
			});

			const sorted = Array.from(areas);
			sorted.sort((a, b) => b - a);

			return sorted.map((a) => match.areas[a].name).join(', ');
		}
		return '';
	};

	const getLabel = (match: Match) => {
		const displayArea = getDisplayArea(match);
		return displayArea ? match.name + ', ' + displayArea : match.name;
	};

	const updateGuesses = async () => {
		const coord = parseCoordinatesToLocation(inputValue);
		if (coord) {
			items = [coord];
			value = '';
			return;
		}
		const pos = place ? maplibregl.LngLat.convert(place) : undefined;
		const biasPlace = pos ? { place: `${pos.lat},${pos.lng}` } : {};
		const { data: matches, error } = await geocode({
			query: {
				...biasPlace,
				text: inputValue,
				language: [language],
				mode: transitModes,
				type
			}
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

	onMount(() => {
		if (focus) {
			ref?.focus();
		}
	});
</script>

{#snippet modeCircle(mode: Mode)}
	{@const modeIcon = getModeStyle({ mode } as LegLike)[0]}
	{@const modeColor = getModeStyle({ mode } as LegLike)[1]}
	<div
		style="background-color: {modeColor}; fill: white;"
		class="flex items-center justify-center rounded-full p-1"
	>
		<svg class="relative size-4 rounded-full">
			<use xlink:href={`#${modeIcon}`}></use>
		</svg>
	</div>
{/snippet}

<Combobox.Root
	type="single"
	allowDeselect={false}
	{value}
	{open}
	onValueChange={(e: string) => {
		if (e) {
			clearTimeout(favTimer);
			selected = deserialize(e);
			inputValue = selected.label!;
			recordHistoryLocation(selected);
			onValueChange(selected);
		}
	}}
>
	<Combobox.Input
		{placeholder}
		{name}
		bind:ref
		class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
		autocomplete="off"
		oninput={(e: Event) => (inputValue = (e.currentTarget as HTMLInputElement).value)}
		aria-label={placeholder}
		data-combobox-input={inputValue}
	/>
	{#if items.length !== 0}
		<Combobox.Portal>
			<Combobox.Content
				align="start"
				class="absolute top-2 z-10 w-[var(--bits-combobox-anchor-width)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md outline-none"
			>
				{#if showHistoryHint}
					<div class="text-s flex items-center justify-between border-b px-4 py-2 text-foreground">
						<span>{t.booking.history}</span>

						<button
							class="rounded p-1 hover:bg-accent"
							onclick={() => {
								clearHistoryLocations();
								history = getHistoryLocations();
							}}
							aria-label="Clear history"
						>
							<Trash2 class="size-4" />
						</button>
					</div>
				{/if}
				{#each items as item (item.value)}
					<Combobox.Item
						class="flex w-full cursor-default select-none rounded-sm py-4 pl-4 pr-2 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50"
						value={JSON.stringify(item.value)}
						label={item.label}
					>
						<div class="flex grow items-center">
							<div class="size-6">
								{#if item.value.match?.type == 'STOP'}
									{@render modeCircle(
										item.value.match.modes?.length ? item.value.match.modes![0] : 'BUS'
									)}
								{:else if item.value.match?.type == 'ADDRESS'}
									<House class="size-5" />
								{:else if item.value.match?.type == 'PLACE'}
									{#if !item.value.match?.category || item.value.match?.category == 'none'}
										<Place class="size-5" />
									{:else}
										<img
											src={`/icons/categories/${item.value.match?.category}.svg`}
											alt={item.value.match?.category}
											class="size-5"
										/>
									{/if}
								{/if}
							</div>
							<div class="ml-4 flex flex-col">
								<span class="overflow-hidden text-ellipsis text-nowrap font-semibold">
									{item.value.match?.name}
								</span>
								<span class="overflow-hidden text-ellipsis text-nowrap text-muted-foreground">
									{getDisplayArea(item.value.match)}
								</span>
							</div>
						</div>
						{#if item.value.match?.type == 'STOP'}
							<div class="ml-4 mt-1 flex flex-row items-center gap-1.5">
								{#each item.value.match.modes! as mode, i (i)}
									{@render modeCircle(mode)}
								{/each}
							</div>
						{/if}
					</Combobox.Item>
				{/each}
			</Combobox.Content>
		</Combobox.Portal>
	{/if}
</Combobox.Root>
