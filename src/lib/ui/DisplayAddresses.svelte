<script lang="ts">
	import MapPin from 'lucide-svelte/icons/map-pin';
	import Circle from 'lucide-svelte/icons/circle';
	import Dots from 'lucide-svelte/icons/ellipsis-vertical';

	const { fromAddress, toAddress }: { fromAddress: string; toAddress: string } = $props();
</script>

<div class="grid grid-cols-[auto_1fr] grid-rows-[auto_auto_auto] gap-x-2">
	<div class="flex items-center justify-center">
		<Circle size={12} />
	</div>
	<div>{fromAddress}</div>
	<div class="flex flex-col items-center justify-center gap-1">
		<Dots size={13} />
	</div>
	<div></div>
	<div class="flex items-center justify-center">
		<MapPin size={12} />
	</div>
	<div>{toAddress}</div>
</div>
