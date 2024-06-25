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
	import * as Card from '$lib/components/ui/card';
	import { Plus, ChevronRight, ChevronLeft } from 'lucide-svelte';

	import Sun from 'lucide-svelte/icons/sun';
	import Moon from 'lucide-svelte/icons/moon';
	import { goto, invalidateAll } from '$app/navigation';
	import { TZ } from '$lib/constants.js';
	import { addAvailability, removeAvailability, updateTour } from '$lib/api.js';

	const df = new DateFormatter('de-DE', { dateStyle: 'long' });

	class Range {
		from!: Date;
		to!: Date;
	}

	class Vehicle {
		license_plate!: string;
		availability!: Array<Range>;
	}

	class Tour extends Range {
		id!: number;
		vehicle_id!: number;
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
			vehicle_id: t.vehicle
		}));
	};

	let vehicles = $state<Map<number, Vehicle>>(loadVehicles());
	let tours = $state<Array<Tour>>(loadTours());

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
		selection = {
			id,
			vehicle,
			start: cell,
			end: cell,
			available: !isAvailable(vehicle, cell)
		};
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
			const vehicle = selection.vehicle;
			const vehicle_id = selection.id;
			const available = selection.available;
			if (available) {
				vehicle.availability.push(selectedRange);
			} else {
				const to_remove = Array<Range>();
				vehicle.availability.forEach((a) => {
					if (selectedRange.from <= a.from && selectedRange.to >= a.to) {
						to_remove.push(a);
					} else if (selectedRange.from > a.from && selectedRange.to < a.to) {
						to_remove.push(a);
						vehicle.availability.push({ from: a.from, to: selectedRange.from });
						vehicle.availability.push({ from: selectedRange.to, to: a.to });
					} else if (selectedRange.from <= a.from && selectedRange.to >= a.from) {
						a.from = selectedRange.to;
					} else if (selectedRange.to >= a.to && selectedRange.from <= a.to) {
						a.to = selectedRange.from;
					}
				});
				to_remove.forEach((r) => {
					vehicle.availability.splice(vehicle.availability.indexOf(r), 1);
				});
			}
			selection = null;
			if (available) {
				await addAvailability(vehicle_id, selectedRange.from, selectedRange.to);
			} else {
				await removeAvailability(vehicle_id, selectedRange.from, selectedRange.to);
			}
			invalidateAll();
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
			await Promise.all(draggedTours.tours.map((t) => updateTour(t.id, t.vehicle_id)));
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
</script>

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
												<div
													class={[
														'w-8',
														'h-8',
														'border',
														'rounded-md',
														cellColor(id, v, cell)
													].join(' ')}
												></div>
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

<div class="flex min-h-screen">
	<Card.Root class="w-fit m-auto">
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
							Place content for the popover here.
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
	</Card.Root>
</div>

<style>
</style>
