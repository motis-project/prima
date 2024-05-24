<script>
	import { Date as ReactiveDate, Map } from 'svelte/reactivity';

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

	// 11 pm local time day before
	let base = new ReactiveDate();
	base.setHours(0, -60, 0, 0);

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
								<tr class="text-xs">
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
					<td class="pr-2">{v.license_plate}</td>
					{#each split(range, 60) as x}
						<td>
							<table class="w-full h-6">
								<tbody>
									<tr>
										{#each split(x, 15) as cell}
											<td
												class="border"
												class:bg-gray-400={is_selected(id, cell)}
												class:bg-orange-400={has_tour(id, cell) && !is_selected(id, cell)}
												class:bg-yellow-100={is_available(v, cell) &&
													!has_tour(id, cell) &&
													!is_selected(id, cell)}
												onmousedown={() => selectionStart(id, v, cell)}
												onmouseover={() => selectContinue(cell)}
											>
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

<div class="flex">
	<div>
		<input
			type="button"
			value="<"
			onclick={() => base.setHours(base.getHours() - 24)}
			class="text-gray-900 bg-white border border-gray-300 focus:outline-none hover:bg-gray-100 focus:ring-4 focus:ring-gray-100 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-600 dark:focus:ring-gray-700"
		/>
	</div>
	<input type="date" value={base_string} disabled />
	<div>
		<input
			type="button"
			value=">"
			onclick={() => base.setHours(base.getHours() + 24)}
			class="text-gray-900 bg-white border border-gray-300 focus:outline-none hover:bg-gray-100 focus:ring-4 focus:ring-gray-100 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-600 dark:focus:ring-gray-700"
		/>
	</div>
</div>

{@render availability_table({ from: base, to: today_morning })}
{@render availability_table({ from: today_morning, to: today_day })}
{@render availability_table({ from: today_day, to: tomorrow_night })}
