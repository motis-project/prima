<script lang="ts">
	import { Circle, MapPin } from 'lucide-svelte';

	const { fromAddress, toAddress } = $props();

	let fromHeight = $state(0);
	let toHeight = $state(0);
	let topMargin = $derived((fromHeight - 16) / 2);
	let botMargin = $derived((toHeight - 20) / 2);
</script>

<div class="flex flex-row gap-1 text-sm">
	<div class="flex flex-col items-center justify-between">
		<Circle class="h-4 w-4" style="margin-top: {topMargin}px" />
		<div class="min-h-4 w-px flex-1 border-l border-dashed border-foreground"></div>
		<MapPin class="h-5 w-5" style="margin-bottom: {botMargin}px" />
	</div>
	<div class="flex flex-col justify-between break-all">
		<div bind:offsetHeight={fromHeight}>{fromAddress}</div>
		<div class="min-h-4"></div>
		<div bind:offsetHeight={toHeight}>{toAddress}</div>
	</div>
</div>
