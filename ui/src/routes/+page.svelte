<script lang="ts">
	import CalendarIcon from "lucide-svelte/icons/calendar";
	import { Calendar } from "$lib/components/ui/calendar/index.js";
	import * as Popover from "$lib/components/ui/popover/index.js";

	import { Date as ReactiveDate, Map } from 'svelte/reactivity';
	import { Button } from "$lib/components/ui/button";
	import * as Card from "$lib/components/ui/card";
	import { Plus } from 'lucide-svelte';

	let vehicles = new Map([
		[
			0,
			{
				license_plate: 'AB-XY-123',
				availability: [
					{
						from: new Date('2024-05-24T05:30:00'),
						to: new Date('2024-05-24T08:45:00')
					},
					{
						from: new Date('2024-05-24T13:30:00'),
						to: new Date('2024-05-24T17:45:00')
					}
				]
			}
		],
		[
			1,
			{
				license_plate: 'AB-XY-321',
				availability: [
					{
						from: new Date('2024-05-24T09:30:00'),
						to: new Date('2024-05-24T12:45:00')
					}
				]
			}
		]
	]);

	let tours = [
		{
			id: 0,
			from: new Date('2024-05-24T14:33:00'),
			to: new Date('2024-05-24T14:46:00'),
			vehicle_id: 0
		},
		{
			id: 1,
			from: new Date('2024-05-24T11:13:00'),
			to: new Date('2024-05-24T11:46:00'),
			vehicle_id: 1
		}
	];

	let day = new ReactiveDate();
	day.setHours(0, 0, 0, 0);

	// 11 pm local time day before
	let base = $derived.by(() => {
		let copy = new Date(day);
		copy.setHours(day.getHours() - 1);
		return copy;
	});

	let base_string = $derived(base.toJSON().slice(0, 10));

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

	const overlaps = (a, b) => a.from < b.to && a.to > b.from;

	const has_tour = (vehicle_id, cell) => {
		return tours.some((t) => vehicle_id == t.vehicle_id && overlaps(t, cell));
	};

	const is_available = (v, cell) => {
		return v.availability.some((a) => overlaps(a, cell));
	};

	const split = (range, size) => {
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

	const selection = $state({ active: false });

	const getSelection = () => {
		return {
			from: new Date(Math.min(selection.start.from, selection.end.from)),
			to: new Date(Math.max(selection.start.to, selection.end.to))
		};
	};

	const is_selected = (id, cell) => {
		return selection.active && selection.id == id && overlaps(getSelection(), cell);
	};

	const selectionStart = (id, vehicle, cell) => {
		selection.active = true;
		selection.id = id;
		selection.vehicle = vehicle;
		selection.start = cell;
		selection.end = cell;
		selection.available = !is_available(vehicle, cell);
	};

	const selectContinue = (cell) => {
		if (selection.active) {
			selection.end = cell;
		}
	};

	const finishSelection = () => {
		if (selection.active) {
			console.log(selection.available, getSelection());
			selection.active = false;
		}
	};
</script>

<svelte:window onmouseup={() => finishSelection()} />

{#snippet availability_table(range)}
	<table class="mb-8 select-none">
		<thead>
			<tr>
				<td><!--Fahrzeug--></td>
				{#each split(range, 60) as x}
					<td
						>{('0' + x.from.getHours()).slice(-2)}:00
						<table>
							<tbody>
								<tr class="text-sm">
									<td>00</td>
									<td class="pl-1">15</td>
									<td class="pl-1">30</td>
									<td class="pl-1">45</td>
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
					<td class="pr-2 tracking-tight leading-none">{v.license_plate}</td>
					{#each split(range, 60) as x}
						<td>
							<table class="w-full">
								<tbody>
									<tr>
										{#each split(x, 15) as cell}
											<td class="border w-8 h-8"
												class:bg-gray-400={is_selected(id, cell)}
												class:bg-orange-400={has_tour(id, cell) && !is_selected(id, cell)}
												class:bg-yellow-100={is_available(v, cell) && !has_tour(id, cell) && !is_selected(id, cell)}
												onmousedown={() => selectionStart(id, v, cell)}
												onmouseover={() => selectContinue(cell)}
												onfocus={() => {}}>
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

<div class="flex h-screen">
	<Card.Root class="w-fit m-auto">
		<div class="flex justify-between">
			<Card.Header>
				<Card.Title>Fahrzeuge und Touren</Card.Title>
				<Card.Description>
					Verwaltung der Fahrzeugverfügbarkeit für das ÖPNV-Taxi
				</Card.Description>
			</Card.Header>
			<div class="font-semibold leading-none tracking-tight p-6 flex gap-4">
				<div class="flex gap-1">
					<Button variant="outline" size="icon" onclick={() => day.setHours(day.getHours() - 24)}>&lt;</Button>
					<Popover.Root>
						<Popover.Trigger asChild let:builder>
						  <Button
							variant="outline"
							class="w-fit justify-start text-left font-normal"
							builders={[builder]}
						  >
							<CalendarIcon class="mr-2 h-4 w-4" />
							{day.toLocaleDateString()}
						  </Button>
						</Popover.Trigger>
						<Popover.Content class="absolute z-10 w-auto p-0">
						  <Calendar/>
						</Popover.Content>
					</Popover.Root>
					<Button variant="outline" size="icon" onclick={() => day.setHours(day.getHours() + 24)}>&gt;</Button>
				</div>
				<div>
					<Popover.Root>
						<Popover.Trigger>
							<Button variant="outline">
								<Plus class="text-black mr-2 h-4 w-4" />
								Fahrzeug hinzufügen
							</Button>
						</Popover.Trigger>
						<Popover.Content class="absolute z-10">
							Place content for the popover here.
						</Popover.Content>
					  </Popover.Root>
				</div>
			</div>
		</div>
		<Card.Content>
			{@render availability_table({ from: base, to: today_morning })}
			{@render availability_table({ from: today_morning, to: today_day })}
			{@render availability_table({ from: today_day, to: tomorrow_night })}
		</Card.Content>
	</Card.Root>
</div>