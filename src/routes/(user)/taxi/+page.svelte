<script lang="ts">
	const { data } = $props();

	import {
		DateFormatter,
		fromDate,
		toCalendarDate,
		getLocalTimeZone
	} from '@internationalized/date';

	import CalendarIcon from 'lucide-svelte/icons/calendar';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';

	import { Date as ReactiveDate, Map } from 'svelte/reactivity';
	import { Button } from '$lib/components/ui/button';
	import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Toaster, toast } from 'svelte-sonner';
	import * as Card from '$lib/components/ui/card';
	import { Plus, ChevronRight, ChevronLeft } from 'lucide-svelte';

	import Sun from 'lucide-svelte/icons/sun';
	import Moon from 'lucide-svelte/icons/moon';
	import { goto, invalidateAll, preloadData } from '$app/navigation';
	import { TZ } from '$lib/constants.js';
	import Label from '$lib/components/ui/label/label.svelte';
	import { addAvailability, removeAvailability, updateTour } from '$lib/api.js';

	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';

	import { Tour } from './Tour';
	import { Range } from './Range';
	import { Event } from './Event';
	import { Location } from './Location';
	import TourDialog from './TourDialog.svelte';
	import { getRoute } from '$lib/api';

	const df = new DateFormatter('de-DE', { dateStyle: 'long' });

	class Vehicle {
		license_plate!: string;
		availability!: Array<Range>;
	}

	const loadVehicles = (): Map<number, Vehicle> => {
		return new Map<number, Vehicle>(
			data.vehicles.map((v) => [
				v.id,
				{
					license_plate: v.license_plate,
					availability: data.availabilities
						.filter((a) => a.vehicle == v.id)
						.map((a) => ({ from: a.start_time, to: a.end_time }))
				}
			])
		);
	};

	const loadTours = (): Array<Tour> => {
		return data.tours.map((t) => ({
			id: t.id,
			from: t.departure,
			to: t.arrival,
			vehicle_id: t.vehicle,
			arrival: t.arrival,
			departure: t.departure
		}));
	};

	let vehicles = $state<Map<number, Vehicle>>(loadVehicles());
	let tours = $state<Array<Tour>>(loadTours());

	let selectedTour = $state.frozen<Tour | null>(null);
	let selectedTourEvents = $state<Array<Event> | null>(null);
	// eslint-disable-next-line
	let routes = $state<Array<Promise<any>> | null>(null);
	let center = $state<Location | null>(null);

	let showTour = $state<{ open: boolean }>({ open: false });

	let value = $state(toCalendarDate(fromDate(data.utcDate, TZ)));
	let day = $derived(new ReactiveDate(value));

	$effect(() => {
		const date = value.toDate('UTC').toISOString().slice(0, 10);
		goto(`/taxi?date=${date}`);
		vehicles = loadVehicles();
		tours = loadTours();
	});

	// 11 pm local time day before
	let base = $derived.by(() => {
		let copy = new Date(day);
		copy.setMinutes(copy.getMinutes() + value.toDate(TZ).getTimezoneOffset() - 60);
		return copy;
	});

	// 8 am today
	let today_morning = $derived.by(() => {
		let copy = new Date(base);
		copy.setHours(base.getHours() + 9);
		return copy;
	});

	// 5 pm today
	let today_day = $derived.by(() => {
		let copy = new Date(today_morning);
		copy.setHours(today_morning.getHours() + 9);
		return copy;
	});

	// 1 am tomorrow
	let tomorrow_night = $derived.by(() => {
		let copy = new Date(today_day);
		copy.setHours(today_day.getHours() + 8);
		return copy;
	});

	const overlaps = (a: Range, b: Range) => a.from < b.to && a.to > b.from;

	const hasTour = (vehicle_id: number, cell: Range) => {
		return tours.some((t) => vehicle_id == t.vehicle_id && overlaps(t, cell));
	};

	const getTours = (vehicle_id: number, cell: Range) => {
		return tours.filter((t) => vehicle_id == t.vehicle_id && overlaps(t, cell));
	};

	const isAvailable = (v: Vehicle, cell: Range) => {
		return v.availability.some((a) => overlaps(a, cell));
	};

	const split = (range: Range, size: number) => {
		let cells = [];
		let prev = new Date(range.from);
		let t = new Date(range.from);
		t.setMinutes(t.getMinutes() + size);
		for (; t <= range.to; t.setMinutes(t.getMinutes() + size)) {
			cells.push({ from: new Date(prev), to: new Date(t) });
			prev = new Date(t);
		}
		return cells;
	};

	// =========
	// Selection
	// ---------
	class Selection {
		id!: number;
		vehicle!: Vehicle;
		start!: Range;
		end!: Range;
		available!: boolean;
	}

	let selection = $state.frozen<Selection | null>(null);

	const getSelection = () => {
		return selection == null
			? null
			: {
					from: new Date(Math.min(selection.start.from.getTime(), selection.end.from.getTime())),
					to: new Date(Math.max(selection.start.to.getTime(), selection.end.to.getTime()))
				};
	};

	const isSelected = (id: number, cell: Range) => {
		return selection != null && selection.id == id && overlaps(getSelection()!, cell);
	};

	const selectionStart = (id: number, vehicle: Vehicle, cell: Range) => {
		if (selection === null) {
			selection = {
				id,
				vehicle,
				start: cell,
				end: cell,
				available: !isAvailable(vehicle, cell)
			};
		}
	};

	const selectionContinue = (cell: Range) => {
		if (selection !== null) {
			selection = { ...selection, end: cell };
		}
	};

	const selectionFinish = async () => {
		if (selection !== null) {
			const selectedRange = {
				from: new Date(Math.min(selection.start.from.getTime(), selection.end.from.getTime())),
				to: new Date(Math.max(selection.start.to.getTime(), selection.end.to.getTime()))
			};
			const vehicle_id = selection.id;
			const available = selection.available;
			let response;
			try {
				if (available) {
					response = await addAvailability(vehicle_id, selectedRange.from, selectedRange.to);
				} else {
					response = await removeAvailability(vehicle_id, selectedRange.from, selectedRange.to);
				}
			} catch {
				toast('Der Server konnte nicht erreicht werden.');
				return;
			}
			if (!response || !response.ok) {
				toast('Verfügbarkeits Update nicht erfolgreich.');
			}
			await invalidateAll();
			selection = null;
		}
	};

	const toggleMode = () => {
		document.documentElement.classList.toggle('dark');
	};

	// ===========
	// Drag & Drop
	// -----------
	class Drag {
		tours!: Array<Tour>;
		vehicle_id!: number;
	}

	let draggedTours = $state<Drag | null>(null);

	const hasOverlap = () => {
		return draggedTours?.tours.some((d) =>
			tours.some((t) => t.vehicle_id == draggedTours?.vehicle_id && overlaps(d, t))
		);
	};

	const dragStart = (vehicle_id: number, cell: Range) => {
		if (cell === undefined) return;
		let tours = getTours(vehicle_id, cell);
		if (tours.length !== 0) {
			draggedTours = { tours, vehicle_id };
		}
	};

	const dragOver = (vehicle_id: number) => {
		if (draggedTours !== null) {
			draggedTours!.vehicle_id = vehicle_id;
		}
	};

	const onDrop = async () => {
		if (draggedTours !== null && !hasOverlap()) {
			draggedTours.tours.forEach(async (t) => {
				t.vehicle_id = draggedTours!.vehicle_id;
			});
			let responses;
			try {
				responses = await Promise.all(
					draggedTours.tours.map((t) => updateTour(t.id, t.vehicle_id))
				);
			} catch {
				toast('Der Server konnte nicht erreicht werden.');
				return;
			}
			if (responses.some((r) => !r.ok)) {
				toast('Tour Update nicht erfolgreich.');
			}
			invalidateAll();
		}
		draggedTours = null;
	};

	const hasDraggedTour = (vehicle_id: number, cell: Range) => {
		return (
			!draggedTours?.tours.some((t) => t.vehicle_id == vehicle_id) &&
			draggedTours?.vehicle_id == vehicle_id &&
			draggedTours?.tours.some((t) => overlaps(t, cell))
		);
	};

	const cellColor = (id: number, v: Vehicle, cell: Range) => {
		if (hasDraggedTour(id, cell)) {
			return hasOverlap() ? 'bg-red-500' : 'bg-orange-200';
		} else if (hasTour(id, cell)) {
			return 'bg-orange-400';
		} else if (selection !== null && isSelected(id, cell)) {
			return selection.available ? 'bg-yellow-100' : '';
		} else if (isAvailable(v, cell)) {
			return 'bg-yellow-100';
		}
	};

	const getRoutes = () => {
		// eslint-disable-next-line
		let routes: Array<Promise<any>> = [];
		if (selectedTourEvents == null || selectedTourEvents!.length == 0) return routes;

		for (let e = 0; e < selectedTourEvents!.length - 1; e++) {
			let e1 = selectedTourEvents![e];
			let e2 = selectedTourEvents![e + 1];

			let route = getRoute({
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
			});
			routes.push(route);
		}
		return routes;
	};

	const getCenter = () => {
		let center = new Location();
		if (selectedTourEvents == null || selectedTourEvents!.length == 0) return center;
		let nEvents = selectedTourEvents!.length;
		return {
			lat: selectedTourEvents!.map((e) => e.latitude).reduce((e, c) => e + c, 0) / nEvents,
			lng: selectedTourEvents!.map((e) => e.longitude).reduce((e, c) => e + c, 0) / nEvents
		};
	};
</script>

<Toaster />

<svelte:window onmouseup={() => selectionFinish()} />

{#snippet availability_table(range)}
	<table class="mb-16 select-none">
		<thead>
			<tr>
				<td><!--Fahrzeug--></td>
				{#each split(range, 60) as x}
					<td
						>{('0' + x.from.getHours()).slice(-2)}:00
						<table>
							<tbody>
								<tr class="text-sm text-muted-foreground">
									<td class="w-8">00</td>
									<td class="pl-1 w-8">15</td>
									<td class="pl-1 w-8">30</td>
									<td class="pl-1 w-8">45</td>
								</tr>
							</tbody>
						</table>
					</td>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each vehicles.entries() as [id, v]}
				<tr>
					<td class="pr-4 text-sm tracking-tight leading-none">{v.license_plate}</td>
					{#each split(range, 60) as x}
						<td>
							<table class="w-full">
								<tbody>
									<tr>
										{#each split(x, 15) as cell}
											<td
												class="cell"
												draggable={hasTour(id, cell)}
												ondragstart={() => dragStart(id, cell)}
												ondragover={() => dragOver(id)}
												ondragend={() => onDrop()}
												onmousedown={() => !hasTour(id, cell) && selectionStart(id, v, cell)}
												onmouseover={() => selectionContinue(cell)}
												onfocus={() => {}}
											>
												{#if hasTour(id, cell)}
													<DropdownMenu.Root>
														<DropdownMenu.Trigger>
															<Button
																class={[
																	'w-8',
																	'h-8',
																	'border',
																	'rounded-md',
																	'hover:bg-orange-400',
																	cellColor(id, v, cell)
																].join(' ')}
															></Button>
														</DropdownMenu.Trigger>
														<DropdownMenu.Content class="absolute z-10">
															<DropdownMenu.Group>
																<DropdownMenu.Label>Touren</DropdownMenu.Label>
																<DropdownMenu.Separator />
																{#each getTours(id, cell) as tour}
																	<DropdownMenu.Item
																		on:click={async () => {
																			const href = `http://localhost:5173/tour-detail?tour=${tour.id}`;
																			const result = await preloadData(href);
																			if (result.type === 'loaded' && result.status === 200) {
																				selectedTour = result.data.tour[0];
																				selectedTourEvents = result.data.events;
																				routes = getRoutes();
																				center = getCenter();
																				showTour.open = true;
																			}
																		}}>{tour.id}</DropdownMenu.Item
																	>
																{/each}
															</DropdownMenu.Group>
														</DropdownMenu.Content>
													</DropdownMenu.Root>
												{:else}
													<div
														class={[
															'w-8',
															'h-8',
															'border',
															'rounded-md',
															cellColor(id, v, cell)
														].join(' ')}
													></div>
												{/if}
											</td>
										{/each}
									</tr>
								</tbody>
							</table>
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
{/snippet}

<div class="flex justify-between">
	<Card.Header>
		<Card.Title>Fahrzeuge und Touren</Card.Title>
		<Card.Description>Fahrzeugverfügbarkeit- und Tourenverwaltung</Card.Description>
	</Card.Header>
	<div class="font-semibold leading-none tracking-tight p-6 flex gap-4">
		<div class="flex gap-1">
			<Button variant="outline" size="icon" on:click={() => (value = value.add({ days: -1 }))}>
				<ChevronLeft class="h-4 w-4" />
			</Button>
			<Popover.Root>
				<Popover.Trigger asChild let:builder>
					<Button
						variant="outline"
						class="w-fit justify-start text-left font-normal"
						builders={[builder]}
					>
						<CalendarIcon class="mr-2 h-4 w-4" />
						{df.format(value.toDate(getLocalTimeZone()))}
					</Button>
				</Popover.Trigger>
				<Popover.Content class="absolute z-10 w-auto">
					<Calendar bind:value />
				</Popover.Content>
			</Popover.Root>
			<Button variant="outline" size="icon" on:click={() => (value = value.add({ days: 1 }))}>
				<ChevronRight class="h-4 w-4" />
			</Button>
		</div>
		<div>
			<Popover.Root>
				<Popover.Trigger>
					<Button variant="outline">
						<Plus class="mr-2 h-4 w-4" />
						{'Fahrzeug hinzufügen'}
					</Button>
				</Popover.Trigger>
				<Popover.Content class="absolute z-10">
					<div class="grid gap-4">
						<div class="space-y-2">
							<h2 class="font-medium leading-none">Fahrzeug:</h2>
						</div>
						<div class="grid w-full max-w-sm items-center gap-1.5">
							<Label for="nummernschild">Nummernschild des Fahrzeugs:</Label>
							<Input type="nummernschild" id="nummernschild" placeholder="DA-AB-1234" />
						</div>
						<div>
							<h6>Maximale Passagieranzahl:</h6>
							<RadioGroup.Root value="three">
								<div class="flex items-center space-x-2">
									<RadioGroup.Item value="three" id="r1" />
									<Label for="r1">3 Passagiere</Label>
								</div>
								<div class="flex items-center space-x-2">
									<RadioGroup.Item value="five" id="r2" />
									<Label for="r2">5 Passagiere</Label>
								</div>
								<div class="flex items-center space-x-2">
									<RadioGroup.Item value="seven" id="r3" />
									<Label for="r3">7 Passagiere</Label>
								</div>
								<RadioGroup.Input name="spacing" />
							</RadioGroup.Root>
						</div>
						<div class="grid gap-2">
							<div class="flex items-center space-x-2">
								<Checkbox id="fahrrad" aria-labelledby="fahrrad-label" />
								<Label
									id="fahrrad-label"
									for="fahrrad"
									class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
								>
									Fahrradmitnahme
								</Label>
							</div>
							<div class="flex items-center space-x-2">
								<Checkbox id="rollstuhl" aria-labelledby="rollstuhl-label" />
								<Label
									id="rollstuhl-label"
									for="rollstuhl"
									class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
								>
									Für Rollstuhlfahrer geeignet
								</Label>
							</div>
							<div class="grid grid-cols-1 items-center gap-4">
								<Button variant="outline">Fahrzeug hinzufügen</Button>
							</div>
						</div>
					</div>
				</Popover.Content>
			</Popover.Root>
		</div>
		<Button on:click={toggleMode} variant="outline" size="icon">
			<Sun
				class="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
			/>
			<Moon
				class="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
			/>
			<span class="sr-only">Toggle theme</span>
		</Button>
	</div>
</div>
<Card.Content class="mt-8">
	{@render availability_table({ from: base, to: today_morning })}
	{@render availability_table({ from: today_morning, to: today_day })}
	{@render availability_table({ from: today_day, to: tomorrow_night })}
</Card.Content>

<TourDialog {selectedTourEvents} {selectedTour} {routes} {center} bind:open={showTour}></TourDialog>
