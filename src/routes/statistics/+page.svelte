<script lang="ts">
	import type { SimulationStats } from '$lib/server/simulation/simulation.js';
	import { Chart } from 'chart.js/auto';
	import { onDestroy } from 'svelte';

	const { data } = $props();

	const statNames = ['requests', 'taxi tours', 'ride share tours'];
	let selectedStatOption = $state('active');
	function getData(entry: SimulationStats, statName: string, statOption: string) {
		let dbData = {
			total: -1,
			cancelled: -1,
			active: -1
		};
		switch (statName) {
			case 'requests':
				dbData = entry.requests;
				break;
			case 'taxi tours':
				dbData = entry.tours;
				break;
			case 'ride share tours':
				dbData = entry.rideShareTours;
		}
		switch (statOption) {
			case 'total':
				return dbData.total;
			case 'cancelled':
				return dbData.cancelled;
			case 'active':
				return dbData.active;
		}
		return -1;
	}

	let chart: Chart | null = null;
	let canvas: HTMLCanvasElement | null = null;

	const selectableActions: (string | undefined)[] = [
		...new Set(
			data.data.filter((d) => Object.keys(d.atomicDurations).length > 1).map((d) => d.action)
		)
	];
	selectableActions.push(undefined);

	let showTimes = $state(true);
	let selectedAction: string | undefined = $state(undefined);
	let filteredData = $derived(
		data.data.filter((d) => selectedAction === undefined || selectedAction === d.action)
	);
	let iterations = $derived(
		[...new Set(filteredData.map((d) => d.iteration))].sort((a, b) => a - b)
	);
	let actionNames = $derived(
		selectedAction === undefined
			? showTimes
				? [...new Set(data.data.map((d) => d.action))]
				: statNames
			: Object.keys(data.data.find((d) => d.action === selectedAction)!.atomicDurations)
	);
	let datasets = $derived(
		actionNames.map((name, i) => {
			const hue = (i / actionNames.length) * 360;

			const yData = iterations.map((iter) => {
				if (selectedAction === undefined) {
					const entry = filteredData.find(
						(d) => d.iteration === iter && (!showTimes || d.action === name)
					);
					if (showTimes) {
						return entry ? entry.durationMs : null;
					}
					return entry ? getData(entry, name, selectedStatOption) : null;
				}
				const entry = filteredData.find((d) => d.iteration === iter && d.action === selectedAction);
				return entry ? entry.atomicDurations[name] : null;
			});

			return {
				label: name,
				data: yData,
				borderColor: `hsl(${hue}, 70%, 50%)`,
				backgroundColor: 'transparent',
				tension: 0.3,
				spanGaps: true
			};
		})
	);

	$effect(() => {
		if (!canvas || !data) return;

		chart?.destroy();
		chart = new Chart(canvas, {
			type: 'line',
			data: {
				labels: iterations,
				datasets
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: true }
				},
				scales: {
					x: {
						title: { display: true, text: 'Iteration' }
					},
					y: {
						title: { display: true, text: 'Time (ms)' }
					}
				}
			}
		});
	});

	onDestroy(() => chart?.destroy());
</script>

{#snippet statButton(name: string)}
	<button
		class="rounded border border-gray-500 px-3 py-1 text-white hover:border-white {!showTimes &&
		selectedStatOption === name
			? 'bg-blue-600'
			: ''}"
		onclick={() => {
			showTimes = false;
			selectedAction = undefined;
			selectedStatOption = name;
		}}
	>
		{`Show number of ${name} requests`}
	</button>
{/snippet}
<div class="flex-col">
	<div class="buttons mb-4 flex flex-row gap-2">
		{#each selectableActions as action}
			<button
				class="rounded border border-gray-500 px-3 py-1 text-white hover:border-white {showTimes &&
				action === selectedAction
					? 'bg-blue-600'
					: ''}"
				onclick={() => {
					showTimes = true;
					selectedAction = action;
				}}
			>
				{action ?? 'Overview'}
			</button>
		{/each}
		{@render statButton('total')}
		{@render statButton('active')}
		{@render statButton('cancelled')}
	</div>

	<div class="chart-container">
		<canvas bind:this={canvas}></canvas>
	</div>
</div>

<style>
	.chart-container {
		width: 100%;
		height: 500px;
		padding: 1rem;
	}

	canvas {
		width: 100%;
		height: 100%;
		background-color: #2c2c2c;
		border-radius: 8px;
	}
</style>
