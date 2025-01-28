<script lang="ts">
	import {
		DateFormatter,
		fromDate,
		toCalendarDate,
		getLocalTimeZone,
		type DateValue
	} from '@internationalized/date';

	import CalendarIcon from 'lucide-svelte/icons/calendar';
	import { Calendar } from '$lib/shadcn/calendar';
	import * as Popover from '$lib/shadcn/popover/index';

	import { SvelteDate } from 'svelte/reactivity';
	import { Button, buttonVariants } from '$lib/shadcn/button';
	import * as Card from '$lib/shadcn/card';
	import { ChevronRight, ChevronLeft } from 'lucide-svelte';
	import { TZ } from '$lib/constants.js';

	import { goto, invalidateAll } from '$app/navigation';

	import TourDialog from '$lib/ui/TourDialog.svelte';
	import AddVehicle from './AddVehicle.svelte';
	import { onMount } from 'svelte';
	import type { Tours } from '$lib/server/db/getTours';

	const { data } = $props();

	type Vehicle = NonNullable<typeof data.vehicles>[0];

	type Range = {
		startTime: Date;
		endTime: Date;
	};

	// ===
	// API
	// ---
	export const updateTour = async (tourId: number, vehicleId: number) => {
		return await fetch('/taxi/availability/api', {
			method: 'POST',
			body: JSON.stringify({
				tour_id: tourId,
				vehicleId: vehicleId
			})
		});
	};

	export const removeAvailability = async (vehicleId: number, from: Date, to: Date) => {
		return await fetch('/taxi/availability/api', {
			method: 'DELETE',
			body: JSON.stringify({
				vehicleId,
				from,
				to
			})
		});
	};

	export const addAvailability = async (vehicleId: number, from: Date, to: Date) => {
		return await fetch('/taxi/availability/api', {
			method: 'POST',
			body: JSON.stringify({
				vehicleId,
				from,
				to
			})
		});
	};

	// ===========
	// Basic Setup
	// -----------
	const df = new DateFormatter('de-DE', { dateStyle: 'long' });

	let selectedTour = $state<{
		tours: Tours | undefined;
	}>({ tours: undefined });

	let value = $state<DateValue>(toCalendarDate(fromDate(data.utcDate!, TZ)));
	let day = $derived(new SvelteDate(value));

	$effect(() => {
		const offset = value.toDate('UTC').getTimezoneOffset();
		goto(
			`/taxi/availability?offset=${offset}&date=${value.toDate('UTC').toISOString().slice(0, 10)}`
		);
	});

	onMount(() => {
		const interval = setInterval(async () => {
			if (selection == null && draggedTours == null) {
				await invalidateAll();
			}
		}, 5000);
		return () => clearInterval(interval);
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

	const asDate = (x: Date | string): Date => (typeof x === 'string' ? new Date(x) : x);

	const overlaps = (a: Range, b: Range) =>
		asDate(a.startTime) < asDate(b.endTime) && asDate(a.endTime) > asDate(b.startTime);

	const hasTour = (vehicleId: number, cell: Range) =>
		data.tours.some((t) => vehicleId == t.vehicleId && overlaps(t, cell));

	const getTours = (vehicleId: number, cell: Range) =>
		data.tours.filter((t) => vehicleId == t.vehicleId && overlaps(t, cell));

	const isAvailable = (v: Vehicle, cell: Range) => v.availability.some((a) => overlaps(a, cell));

	const split = (range: Range, size: number): Array<Range> => {
		let cells: Array<Range> = [];
		let prev = new Date(range.startTime);
		let t = new Date(range.startTime);
		t.setMinutes(t.getMinutes() + size);
		for (; t <= range.endTime; t.setMinutes(t.getMinutes() + size)) {
			cells.push({ startTime: new Date(prev), endTime: new Date(t) });
			prev = new Date(t);
		}
		return cells;
	};

	// =========
	// Selection
	// ---------
	type Selection = {
		id: number;
		vehicle: Vehicle;
		start: Range;
		end: Range;
		available: boolean;
	};

	let selection = $state.raw<Selection | null>(null);

	const getSelection = () => {
		return selection == null
			? null
			: {
					startTime: new Date(
						Math.min(selection.start.startTime.getTime(), selection.end.endTime.getTime())
					),
					endTime: new Date(
						Math.max(selection.start.endTime.getTime(), selection.end.endTime.getTime())
					)
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
			const selectedRange: Range = {
				startTime: new Date(
					Math.min(selection.start.startTime.getTime(), selection.end.startTime.getTime())
				),
				endTime: new Date(
					Math.max(selection.start.endTime.getTime(), selection.end.endTime.getTime())
				)
			};
			const vehicleId = selection.id;
			const available = selection.available;
			let response;
			try {
				if (available) {
					response = await addAvailability(
						vehicleId,
						selectedRange.startTime,
						selectedRange.endTime
					);
				} else {
					response = await removeAvailability(
						vehicleId,
						selectedRange.startTime,
						selectedRange.endTime
					);
				}
			} catch {
				alert('Der Server konnte nicht erreicht werden.');
				return;
			}
			if (!response || !response.ok) {
				alert('Verfügbarkeits Update nicht erfolgreich.');
			}
			await invalidateAll();
			selection = null;
		}
	};

	// ===========
	// Drag & Drop
	// -----------
	type Drag = {
		tours: Tours;
		vehicleId: number;
	};

	let draggedTours = $state<Drag | null>(null);

	const hasOverlap = () => {
		return draggedTours?.tours.some((d) =>
			data.tours.some((t) => t.vehicleId == draggedTours?.vehicleId && overlaps(d, t))
		);
	};

	const dragStart = (vehicleId: number, cell: Range) => {
		if (cell === undefined) return;
		let tours = getTours(vehicleId, cell);
		if (tours.length !== 0) {
			draggedTours = { tours, vehicleId };
		}
	};

	const dragOver = (vehicleId: number) => {
		if (draggedTours !== null) {
			draggedTours!.vehicleId = vehicleId;
		}
	};

	const onDrop = async () => {
		if (draggedTours !== null && !hasOverlap()) {
			draggedTours.tours.forEach(async (t) => {
				t.vehicleId = draggedTours!.vehicleId;
			});
			let responses;
			try {
				responses = await Promise.all(draggedTours.tours.map((t) => updateTour(t.id, t.vehicleId)));
			} catch {
				alert('Der Server konnte nicht erreicht werden.');
				return;
			}
			if (responses.some((r) => !r.ok)) {
				alert('Tour Update nicht erfolgreich.');
			}
			invalidateAll();
		}
		draggedTours = null;
	};

	const hasDraggedTour = (vehicleId: number, cell: Range) => {
		return (
			!draggedTours?.tours.some((t) => t.vehicleId == vehicleId) &&
			draggedTours?.vehicleId == vehicleId &&
			draggedTours?.tours.some((t) => overlaps(t, cell))
		);
	};

	const cellColor = (id: number, v: Vehicle, cell: Range) => {
		let tours = getTours(id, cell);
		if (hasDraggedTour(id, cell)) {
			return hasOverlap() ? 'bg-red-500' : 'bg-orange-200';
		} else if (tours.length > 1) {
			return 'bg-orange-600';
		} else if (tours.length != 0) {
			return 'bg-orange-400';
		} else if (selection !== null && isSelected(id, cell)) {
			return selection.available ? 'bg-yellow-100' : '';
		} else if (isAvailable(v, cell)) {
			return 'bg-yellow-100';
		}
	};
</script>

<svelte:window onmouseup={() => selectionFinish()} />

{#snippet availabilityTable(range: Range)}
	<table class="mb-16 select-none">
		<thead>
			<tr>
				<td><!--Fahrzeug--></td>
				{#each split(range, 60) as x}
					<td>
						{('0' + x.startTime.getHours()).slice(-2)}:00
						<table>
							<tbody>
								<tr class="text-sm text-muted-foreground">
									<td class="w-8">00</td>
									<td class="w-8 pl-1">15</td>
									<td class="w-8 pl-1">30</td>
									<td class="w-8 pl-1">45</td>
								</tr>
							</tbody>
						</table>
					</td>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each data.vehicles.entries() as [id, v]}
				<tr>
					<td
						class="h-full pr-2 align-middle font-mono text-sm font-semibold leading-none tracking-tight"
					>
						{v.licensePlate}
					</td>
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
													<!-- svelte-ignore a11y_click_events_have_key_events -->
													<!-- svelte-ignore a11y_no_static_element_interactions -->
													<div
														onclick={() => {
															selectedTour.tours = getTours(id, cell);
														}}
														class={[
															'cursor-pointer',
															'w-8',
															'h-8',
															'border',
															'rounded-md',
															cellColor(id, v, cell)
														].join(' ')}
													></div>
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

<Card.Root>
	<div class="flex justify-between">
		<Card.Header>
			<Card.Title>Fahrzeuge und Touren</Card.Title>
			<Card.Description>Fahrzeugverfügbarkeit- und Tourenverwaltung</Card.Description>
		</Card.Header>

		<div class="flex gap-4 p-6 font-semibold leading-none tracking-tight">
			<div class="flex gap-1">
				<Button variant="outline" size="icon" onclick={() => (value = value.add({ days: -1 }))}>
					<ChevronLeft class="size-4" />
				</Button>
				<Popover.Root>
					<Popover.Trigger
						class={buttonVariants({
							variant: 'outline',
							class: 'w-fit justify-start text-left font-normal'
						})}
					>
						<CalendarIcon class="mr-2 size-4" />
						{df.format(value.toDate(getLocalTimeZone()))}
					</Popover.Trigger>
					<Popover.Content class="w-auto p-0">
						<Calendar type="single" bind:value />
					</Popover.Content>
				</Popover.Root>
				<Button variant="outline" size="icon" onclick={() => (value = value.add({ days: 1 }))}>
					<ChevronRight class="size-4" />
				</Button>
			</div>
			<AddVehicle />
		</div>
	</div>

	<Card.Content class="mt-8">
		{#if !data.companyDataComplete}
			<div class="flex min-h-[45vh] w-full flex-col items-center justify-center">
				<h2 class="mb-4 text-xl font-semibold leading-none tracking-tight">
					Stammdaten unvollständig.
				</h2>
				<p class="text-muted-foreground">
					Fahrzeuge können erst angelegt werden, wenn die Unternehmens-Stammdaten vollständig sind.
				</p>
			</div>
		{:else if data.vehicles.length === 0}
			<div class="flex min-h-[45vh] w-full flex-col items-center justify-center">
				<h2 class="mb-4 text-xl font-semibold leading-none tracking-tight">
					Kein Fahrzeug vorhanden.
				</h2>
				<p class="text-muted-foreground">
					Es muss mindestens ein Fahrzeug angelegt sein, um Verfügbarkeiten angeben zu können.
				</p>
			</div>
		{:else}
			{@render availabilityTable({ startTime: base, endTime: today_morning })}
			{@render availabilityTable({ startTime: today_morning, endTime: today_day })}
			{@render availabilityTable({ startTime: today_day, endTime: tomorrow_night })}
		{/if}
	</Card.Content>
</Card.Root>

<TourDialog bind:open={selectedTour} />
