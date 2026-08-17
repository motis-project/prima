<script lang="ts">
	import Download from 'lucide-svelte/icons/download';
	import pkg from 'file-saver';
	import Papa from 'papaparse';

	const { saveAs } = pkg;

	const { data } = $props();

	type StatEntry = Record<string, number>;
	type StatEntries = Record<string, StatEntry>;
	type StatView = 'distance' | 'duration';

	let statView = $state<StatView>('distance');
	const numberFormatter = new Intl.NumberFormat('de-DE');
	const kilometerFormatter = new Intl.NumberFormat('de-DE', {
		minimumFractionDigits: 0,
		maximumFractionDigits: 1
	});

	const tourSections = [
		{ title: 'Taxi tours', entries: data.tourEntries },
		{ title: 'Ride-share tours', entries: data.rsTourEntries }
	];

	const requestSections = [
		{
			title: 'ÖPNV bei Taxi Anfragen',
			entries: data.rsRequestEntries
		},
		{
			title: 'ÖPNV bei Ridesharing Anfragen',
			entries: data.requestEntries
		}
	] as const;

	function formatNumber(value: number) {
		return numberFormatter.format(value);
	}

	function kilometers(value: number) {
		return `${kilometerFormatter.format(value / 1000)} km`;
	}

	function duration(value: number) {
		const minutes = Math.floor(value / 60_000);
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		return `${formatNumber(hours)}:${remainingMinutes.toString().padStart(2, '0')}`;
	}

	function tableHeaders(entries: StatEntries) {
		return entryHeaders(entries).filter(
			(header) =>
				header === 'Count' ||
				(statView === 'distance' ? header.endsWith(' m') : header.endsWith(' ms'))
		);
	}

	function entryHeaders(entries: StatEntries) {
		return Object.keys(Object.values(entries)[0] ?? {});
	}

	function tableLabel(header: string) {
		return header.replace(/ (m|ms)$/, '');
	}

	function tableValue(header: string, value: number) {
		if (header.endsWith(' m')) {
			return kilometers(value);
		}
		if (header.endsWith(' ms')) {
			return duration(value);
		}
		return formatNumber(value);
	}

	function entryValue(entry: StatEntry, header: string) {
		return entry[header];
	}

	function exportCsv() {
		const sections = [...tourSections, ...requestSections];
		const valueHeaders = [...new Set(sections.flatMap((section) => entryHeaders(section.entries)))];
		const rows: Array<Array<string | number>> = [
			['Category', 'Status', ...valueHeaders.map(csvHeader)]
		];

		for (const section of sections) {
			for (const [status, entry] of Object.entries(section.entries)) {
				rows.push([
					section.title,
					status,
					...valueHeaders.map((header) =>
						entry[header] === undefined
							? ''
							: header.endsWith(' ms')
								? duration(entry[header])
								: header.endsWith(' m')
									? kilometerFormatter.format(entry[header] / 1000)
									: formatNumber(Math.round(entry[header]))
					)
				]);
			}
		}

		const csvContent = Papa.unparse(rows, { header: true, delimiter: ';' });
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		saveAs(blob, 'statistics.csv');
	}

	function csvHeader(header: string) {
		if (header.endsWith(' m')) {
			return `${tableLabel(header)} km`;
		}
		if (header.endsWith(' ms')) {
			return `${tableLabel(header)} hh:mm`;
		}
		return header;
	}

	function setStatView(view: StatView) {
		statView = view;
	}
</script>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-8 text-gray-950 dark:text-gray-100">
	<header class="flex items-center justify-between gap-4">
		<h1 class="text-2xl font-semibold">Statistics</h1>
		<div class="flex items-center gap-3">
			<div
				class="inline-flex rounded border border-gray-300 p-0.5 text-sm dark:border-gray-700"
				aria-label="Statistic type"
			>
				<button
					type="button"
					class="px-3 py-1.5 font-medium {statView === 'distance'
						? 'bg-gray-950 text-white dark:bg-gray-100 dark:text-gray-950'
						: 'hover:bg-gray-100 dark:hover:bg-gray-800'}"
					aria-pressed={statView === 'distance'}
					onclick={() => setStatView('distance')}
				>
					Distance
				</button>
				<button
					type="button"
					class="px-3 py-1.5 font-medium {statView === 'duration'
						? 'bg-gray-950 text-white dark:bg-gray-100 dark:text-gray-950'
						: 'hover:bg-gray-100 dark:hover:bg-gray-800'}"
					aria-pressed={statView === 'duration'}
					onclick={() => setStatView('duration')}
				>
					Duration
				</button>
			</div>
			<button
				type="button"
				class="inline-flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
				onclick={exportCsv}
			>
				<Download class="size-4" />
				Export CSV
			</button>
		</div>
	</header>

	<section class="grid gap-6 lg:grid-cols-2">
		{#each tourSections as section}
			<div
				class="rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
			>
				<h2 class="mb-4 text-lg font-medium">{section.title}</h2>
				<div class="overflow-x-auto">
					<table class="w-full text-left text-sm">
						<thead class="border-b text-gray-600 dark:border-gray-700 dark:text-gray-300">
							<tr>
								<th class="py-2 pr-4 font-medium">Status</th>
								{#each tableHeaders(section.entries) as header}
									<th class="py-2 pr-4 font-medium last:pr-0">{tableLabel(header)}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each Object.entries(section.entries) as [status, entry]}
								<tr class="border-b border-gray-100 last:border-b-0 dark:border-gray-800">
									<td class="py-2 pr-4 capitalize">{status}</td>
									{#each tableHeaders(section.entries) as header}
										<td class="py-2 pr-4 tabular-nums last:pr-0">
											{tableValue(header, entryValue(entry, header))}
										</td>
									{/each}
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
			<div
				class="rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
			>
				<h2 class="mb-4 text-lg font-medium">{section.title}</h2>
				<div class="overflow-x-auto">
					<table class="w-full text-left text-sm">
						<thead class="border-b text-gray-600 dark:border-gray-700 dark:text-gray-300">
							<tr>
								<th class="py-2 pr-4 font-medium">Status</th>
								{#each tableHeaders(section.entries) as header}
									<th class="py-2 pr-4 font-medium last:pr-0">{tableLabel(header)}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each Object.entries(section.entries) as [status, entry]}
								<tr class="border-b border-gray-100 last:border-b-0 dark:border-gray-800">
									<td class="py-2 pr-4 capitalize">{status}</td>
									{#each tableHeaders(section.entries) as header}
										<td class="py-2 pr-4 tabular-nums last:pr-0">
											{tableValue(header, entryValue(entry, header))}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/each}
	</section>
</div>
