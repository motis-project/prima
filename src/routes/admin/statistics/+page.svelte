<script lang="ts">
	const { data } = $props();

	const tourSections = [
		{ title: 'Taxi tours', entries: data.tourEntries },
		{ title: 'Ride-share tours', entries: data.rsTourEntries }
	];

	const requestSections = [
		{ title: 'Taxi requests', entries: data.rsRequestEntries, distanceLabel: 'Taxi', distanceField: 'taxiDistance' },
		{
			title: 'Ride-share requests',
			entries: data.requestEntries,
			distanceLabel: 'Ride share',
			distanceField: 'rideShareDistance'
		}
	] as const;

	function requestDistance(
		entry: { taxiDistance: number; rideShareDistance: number },
		field: 'taxiDistance' | 'rideShareDistance'
	) {
		return entry[field];
	}

	function meters(value: number) {
		return `${Math.round(value).toLocaleString()} m`;
	}
</script>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-8 text-gray-950 dark:text-gray-100">
	<header>
		<h1 class="text-2xl font-semibold">Statistics</h1>
	</header>

	<section class="grid gap-6 lg:grid-cols-2">
		{#each tourSections as section}
			<div class="rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
				<h2 class="mb-4 text-lg font-medium">{section.title}</h2>
				<div class="overflow-x-auto">
					<table class="w-full text-left text-sm">
						<thead class="border-b text-gray-600 dark:border-gray-700 dark:text-gray-300">
							<tr>
								<th class="py-2 pr-4 font-medium">Status</th>
								<th class="py-2 pr-4 font-medium">Count</th>
								<th class="py-2 pr-4 font-medium">Approach/return</th>
								<th class="py-2 pr-4 font-medium">Fully paid</th>
								<th class="py-2 pr-4 font-medium">Occupied</th>
								<th class="py-2 pr-4 font-medium">Passenger</th>
								<th class="py-2 font-medium">Total</th>
							</tr>
						</thead>
						<tbody>
							{#each Object.entries(section.entries) as [status, entry]}
								<tr class="border-b border-gray-100 last:border-b-0 dark:border-gray-800">
									<td class="py-2 pr-4 capitalize">{status}</td>
									<td class="py-2 pr-4 tabular-nums">{entry.count}</td>
									<td class="py-2 pr-4 tabular-nums">{meters(entry.approachAndReturnM)}</td>
									<td class="py-2 pr-4 tabular-nums">{meters(entry.fullyPayedM)}</td>
									<td class="py-2 pr-4 tabular-nums">{meters(entry.occupiedM)}</td>
									<td class="py-2 pr-4 tabular-nums">{meters(entry.cumulatedPassengerM)}</td>
									<td class="py-2 tabular-nums">{meters(entry.totalM)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/each}
	</section>

	<section class="grid gap-6 lg:grid-cols-2">
		{#each requestSections as section}
			<div class="rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
				<h2 class="mb-4 text-lg font-medium">{section.title}</h2>
				<div class="overflow-x-auto">
					<table class="w-full text-left text-sm">
						<thead class="border-b text-gray-600 dark:border-gray-700 dark:text-gray-300">
							<tr>
								<th class="py-2 pr-4 font-medium">Status</th>
								<th class="py-2 pr-4 font-medium">Count</th>
								<th class="py-2 pr-4 font-medium">{section.distanceLabel}</th>
								<th class="py-2 font-medium">Public transport</th>
							</tr>
						</thead>
						<tbody>
							{#each Object.entries(section.entries) as [status, entry]}
								<tr class="border-b border-gray-100 last:border-b-0 dark:border-gray-800">
									<td class="py-2 pr-4 capitalize">{status}</td>
									<td class="py-2 pr-4 tabular-nums">{entry.count}</td>
									<td class="py-2 pr-4 tabular-nums">{meters(requestDistance(entry, section.distanceField))}</td>
									<td class="py-2 tabular-nums">{meters(entry.publicTransportDistance)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/each}
	</section>
</div>
