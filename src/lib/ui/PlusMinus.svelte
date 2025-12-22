<script lang="ts">
	import { Button } from '$lib/shadcn/button';
	import { CircleMinus, CirclePlus } from 'lucide-svelte';
	let {
		value = $bindable(),
		min,
		max,
		step,
		classes
	}: {
		value: number;
		min: number;
		max: number;
		step: number;
		classes: string;
	} = $props();
</script>

<div class={classes}>
	<Button variant="ghost" onclick={() => (value = Math.max(value - step, min))}>
		<CircleMinus />
	</Button>
	{value}
	<Button variant="ghost" onclick={() => (value = Math.min(value + step, max))}>
		<CirclePlus />
	</Button>
</div>
