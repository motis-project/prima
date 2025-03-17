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
	import * as Popover from '$lib/shadcn/popover';
	import * as HoverCard from '$lib/shadcn/hover-card';

	import { SvelteDate } from 'svelte/reactivity';
	import { Button, buttonVariants } from '$lib/shadcn/button';
	import * as Card from '$lib/shadcn/card';
	import { ChevronRight, ChevronLeft } from 'lucide-svelte';
	import { EARLIEST_SHIFT_START, LATEST_SHIFT_END, LOCALE, TZ } from '$lib/constants.js';

	import { goto, invalidateAll } from '$app/navigation';

	import TourDialog from '$lib/ui/TourDialog.svelte';
	import AddVehicle from './AddVehicle.svelte';
	import { onMount } from 'svelte';
	import Message from '$lib/ui/Message.svelte';
	import type { UnixtimeMs } from '$lib/util/UnixtimeMs';
	import type { LngLatLike } from 'maplibre-gl';
	import { HOUR, MINUTE } from '$lib/util/time';
	import type { ToursWithRequests, TourWithRequests } from '$lib/util/getToursTypes';
	import { getAllowedTimes } from '$lib/util/getAllowedTimes';
	import { getLatestEventTime } from '$lib/util/getLatestEventTime';
	import { getAlterableTimeframe } from '$lib/util/getAlterableTimeframe';
	import { getPossibleInsertions } from '$lib/util/booking/getPossibleInsertions';

	const { data, form } = $props();

	type Vehicle = NonNullable<typeof data.vehicles>[0];

	type Range = {
		startTime: UnixtimeMs;
		endTime: UnixtimeMs;
	};

	// ===
	// API
	// ---
	const updateTour = async (tourId: number, vehicleId: number) => {
		return await fetch('/taxi/availability/api/tour', {
			method: 'POST',
			body: JSON.stringify({ tourId, vehicleId })
		});
	};

	const removeAvailability = async (vehicleId: number, from: UnixtimeMs, to: UnixtimeMs) => {
		return await fetch('/taxi/availability/api/availability', {
			method: 'DELETE',
			body: JSON.stringify({ vehicleId, from, to })
		});
	};

	const addAvailability = async (vehicleId: number, from: UnixtimeMs, to: UnixtimeMs) => {
		return await fetch('/taxi/availability/api/availability', {
			method: 'POST',
			body: JSON.stringify({ vehicleId, from, to })
		});
	};

	// ===========
	// Basic Setup
	// -----------
	const df = new DateFormatter(LOCALE, { dateStyle: 'long' });

	let selectedTour = $state<{
		tours: ToursWithRequests | undefined;
		isAdmin: boolean;
		companyCoordinates: LngLatLike;
	}>({
		tours: undefined,
		isAdmin: false,
		companyCoordinates: data.companyCoordinates!
	});

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

	// 5 am today
	let base = $derived.by(() => {
		let copy = new Date(day);
		copy.setMinutes(copy.getMinutes() + value.toDate(TZ).getTimezoneOffset() + 300);
		return copy;
	});

	// 2 pm today
	let todayDay = $derived.by(() => {
		let copy = new Date(base);
		copy.setHours(base.getHours() + 9);
		return copy;
	});

	// 10 pm today
	let todayEvening = $derived.by(() => {
		let copy = new Date(todayDay);
		copy.setHours(todayDay.getHours() + 8);
		return copy;
	});
	console.log({ tours: data.tours });
	const overlaps = (a: Range, b: Range) => a.startTime < b.endTime && a.endTime > b.startTime;

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
		for (; t.getTime() <= range.endTime; t.setMinutes(t.getMinutes() + size)) {
			cells.push({ startTime: prev.getTime(), endTime: t.getTime() });
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
					startTime: Math.min(selection.start.startTime, selection.end.startTime),
					endTime: Math.max(selection.start.endTime, selection.end.endTime)
				};
	};

	const isSelected = (id: number, cell: Range) => {
		return selection != null && selection.id == id && overlaps(getSelection()!, cell);
	};

	const isAvailabilityAlterable = (cell: Range) => {
		const allowed = getAllowedTimes(
			cell.startTime + MINUTE,
			cell.endTime - MINUTE,
			EARLIEST_SHIFT_START - HOUR,
			LATEST_SHIFT_END + HOUR
		)[0].intersect(getAlterableTimeframe());
		return (
			allowed != undefined && allowed.startTime <= cell.startTime && allowed.endTime >= cell.endTime
		);
	};

	const selectionStart = (id: number, vehicle: Vehicle, cell: Range) => {
		console.log('selectionStart', id);
		if (selection === null && isAvailabilityAlterable(cell)) {
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
		if (selection !== null && isAvailabilityAlterable(cell)) {
			selection = { ...selection, end: cell };
		}
	};

	const selectionFinish = async () => {
		if (selection !== null) {
			const selectedRange: Range = {
				startTime: Math.min(selection.start.startTime, selection.end.startTime),
				endTime: Math.max(selection.start.endTime, selection.end.endTime)
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
		tours: ToursWithRequests;
		vehicleId: number;
	};

	let draggedTours = $state<Drag | null>(null);

	const hasOverlap = () => {
		return draggedTours?.tours.some((d) =>
			data.tours.some((t) => t.vehicleId == draggedTours?.vehicleId && overlaps(d, t))
		);
	};

	const isTourDragable = (tour: TourWithRequests) => {
		return (
			Math.min(...tour.requests.flatMap((r) => r.events.map((e) => getLatestEventTime(e)))) >=
			Date.now()
		);
	};

	const hasDragableTour = (vehicleId: number, cell: Range) =>
		data.tours
			.filter((t) => vehicleId == t.vehicleId && overlaps(t, cell))
			.some((t) => isTourDragable(t));

	const dragStart = (vehicleId: number, cell: Range) => {
		if (cell === undefined) return;
		let tours = getTours(vehicleId, cell).filter((t) => isTourDragable(t));
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
				responses = await Promise.all(
					draggedTours.tours.map((t) => updateTour(t.tourId, t.vehicleId))
				);
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

	const acceptsAnyTour = (v: Vehicle) => {
		return draggedTours!.tours.some((tour) => {
			const events = tour.requests.flatMap((r) => r.events);
			const possibleInsertions = getPossibleInsertions(
				v,
				{ bikes: 0, wheelchairs: 0, passengers: 0, luggage: 0 },
				events
			);
			return (
				possibleInsertions.length == 1 &&
				possibleInsertions[0].earliestPickup === 0 &&
				possibleInsertions[0].latestDropoff === events.length
			);
		});
	};

	const cellColor = (id: number, v: Vehicle, cell: Range) => {
		let tours = getTours(id, cell);
		if (hasDraggedTour(id, cell)) {
			return !acceptsAnyTour(v) || hasOverlap() ? 'bg-red-500' : 'bg-orange-200';
		}
		if (tours.length != 0) {
			if (!tours.some((t) => isTourDragable(t))) {
				if (tours.length > 1) {
					return 'bg-orange-600 bg-opacity-70';
				}
				return 'bg-orange-400 bg-opacity-60 dark:bg-opacity-70';
			}
			if (tours.length != 1) {
				return 'bg-orange-600';
			}
			return 'bg-orange-400';
		}
		if (!isAvailabilityAlterable(cell)) {
			if (isAvailable(v, cell)) {
				return 'border-none border-gray-50 bg-yellow-100 bg-opacity-40 dark:bg-opacity-60';
			}
			return 'border-none';
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
						{('0' + new Date(x.startTime).getHours()).slice(-2)}:00
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
			{#each data.vehicles as v}
				<tr>
					<td
						class="h-full pr-2 align-middle font-mono text-sm font-semibold leading-none tracking-tight"
					>
						<HoverCard.Root>
							<HoverCard.Trigger>{v.licensePlate}</HoverCard.Trigger>
							<HoverCard.Content>
								<ul class="list-inside list-disc">
									<li>Anzahl Passagiere: {v.passengers}</li>
									<li>Rollstuhl: {v.wheelchairs === 0 ? 'Nein' : 'Ja'}</li>
									<li>Gepäckstücke: {v.luggage}</li>
								</ul>
							</HoverCard.Content>
						</HoverCard.Root>
					</td>
					{#each split(range, 60) as x}
						<td>
							<table class="w-full">
								<tbody>
									<tr>
										{#each split(x, 15) as cell}
											<td
												data-testid="{v.licensePlate}-{new Date(cell.startTime).toISOString()}"
												class="cell"
												draggable={hasDragableTour(v.id, cell)}
												ondragstart={() => dragStart(v.id, cell)}
												ondragover={() => dragOver(v.id)}
												ondragend={() => onDrop()}
												onmousedown={() => !hasTour(v.id, cell) && selectionStart(v.id, v, cell)}
												onmouseover={() => selectionContinue(cell)}
												onfocus={() => {}}
											>
												{#if hasTour(v.id, cell)}
													<!-- svelte-ignore a11y_click_events_have_key_events -->
													<!-- svelte-ignore a11y_no_static_element_interactions -->
													<div
														onclick={() => {
															selectedTour.tours = getTours(v.id, cell);
														}}
														class={[
															'cursor-pointer',
															'w-8',
															'h-8',
															'border',
															'rounded-md',
															cellColor(v.id, v, cell)
														].join(' ')}
													></div>
												{:else}
													<div
														class={[
															'w-8',
															'h-8',
															'border',
															'rounded-md',
															cellColor(v.id, v, cell)
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
		<Message msg={form?.msg} class="mb-4" />

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
			{@render availabilityTable({ startTime: base.getTime(), endTime: todayDay.getTime() })}
			{@render availabilityTable({
				startTime: todayDay.getTime(),
				endTime: todayEvening.getTime()
			})}
		{/if}
	</Card.Content>
</Card.Root>

<TourDialog bind:tours={selectedTour.tours} isAdmin={selectedTour.isAdmin} />
