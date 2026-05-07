<script lang="ts">
	import Download from 'lucide-svelte/icons/download';
	import pkg from 'file-saver';
	import Papa from 'papaparse';

	const { saveAs } = pkg;

	const { data } = $props();

	type StatEntry = Record<string, number>;
	type StatEntries = Record<string, StatEntry>;

	const tourSections = [
		{ title: 'Taxi tours', entries: data.tourEntries },
		{ title: 'Ride-share tours', entries: data.rsTourEntries }
	];

	const requestSections = [
		{
			title: 'Taxi requests',
			entries: data.rsRequestEntries
		},
		{
			title: 'Ride-share requests',
			entries: data.requestEntries
		}
	] as const;

	function meters(value: number) {
		return `${Math.round(value).toLocaleString()} m`;
	}

	function tableHeaders(entries: StatEntries) {
		return Object.keys(Object.values(entries)[0] ?? {});
	}

	function tableLabel(header: string) {
		return header.replace(/ m$/, '');
	}

	function tableValue(header: string, value: number) {
		return header.endsWith(' m') ? meters(value) : value.toLocaleString();
	}

	function exportCsv() {
		const sections = [...tourSections, ...requestSections];
		const valueHeaders = [...new Set(sections.flatMap((section) => tableHeaders(section.entries)))];
		const rows: Array<Array<string | number>> = [['Category', 'Status', ...valueHeaders]];

		for (const section of sections) {
			for (const [status, entry] of Object.entries(section.entries)) {
				rows.push([
					section.title,
					status,
					...valueHeaders.map((header) =>
						entry[header] === undefined ? '' : Math.round(entry[header])
					)
				]);
			}
		}

		const csvContent = Papa.unparse(rows, { header: true, delimiter: ';' });
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		saveAs(blob, 'statistics.csv');
	}
</script>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-8 text-gray-950 dark:text-gray-100">
	<header class="flex items-center justify-between gap-4">
		<h1 class="text-2xl font-semibold">Statistics</h1>
		<button
			type="button"
			class="inline-flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
			onclick={exportCsv}
		>
			<Download class="size-4" />
			Export CSV
		</button>
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
									{#each Object.entries(entry) as [header, value]}
										<td class="py-2 pr-4 tabular-nums last:pr-0">{tableValue(header, value)}</td>
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
									{#each Object.entries(entry) as [header, value]}
										<td class="py-2 pr-4 tabular-nums last:pr-0">{tableValue(header, value)}</td>
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
