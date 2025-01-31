<script lang="ts">
	import { getModeStyle, routeColor, type LegLike } from './modeStyle';
	import { cn } from './utils';

	const {
		l,
		class: className,
		onClickTrip
	}: {
		l: LegLike;
		class?: string;
		onClickTrip: (tripId: string) => void;
	} = $props();

	const modeIcon = getModeStyle(l)[0];
</script>

<button
	class={cn(
		'flex h-8 items-center text-nowrap rounded-full pl-2 pr-1 font-bold',
		className,
		l.routeShortName ? 'pr-3' : undefined
	)}
	style={routeColor(l)}
	onclick={() => {
		if (l.tripId) {
			onClickTrip(l.tripId);
		} else {
			console.log('tripId missing', l);
		}
	}}
>
	<svg class="relative mr-2 max-h-6 min-h-6 min-w-6 max-w-6 rounded-full">
		<use xlink:href={`#${modeIcon}`}></use>
	</svg>
	<div class="text-center">
		{l.routeShortName}
	</div>
</button>
