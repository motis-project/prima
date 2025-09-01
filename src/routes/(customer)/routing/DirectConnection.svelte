<script lang="ts">
	import { Button, type ButtonProps } from '$lib/shadcn/button';
	import { formatDurationSec } from './formatDuration';
	import { getModeStyle, routeColor } from '$lib/ui/modeStyle';
	import type { Itinerary } from '$lib/openapi';

	const {
		d,
		...restProps
	}: {
		d: Itinerary;
	} & ButtonProps = $props();

	const modeStyles = [
		...new Map(d.legs.map((l) => [JSON.stringify(getModeStyle(l)), getModeStyle(l)])).values()
	];

	const leg = d.legs.find((leg) => leg.mode !== 'WALK') ?? d.legs[0]!;
</script>

<Button variant="child" {...restProps}>
	<div
		class="flex h-8 items-center text-nowrap rounded-lg px-2 py-1 text-sm font-bold"
		style={routeColor(leg)}
	>
		{#each modeStyles as [icon, _color, _textColor], i (i)}
			<svg class="relative mr-1 h-4 w-4 rounded-full">
				<use xlink:href={`#${icon}`}></use>
			</svg>
		{/each}
		{formatDurationSec(d.duration)}
	</div>
</Button>
