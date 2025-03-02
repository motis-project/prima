<script>
	import { buttonVariants } from '$lib/shadcn/button';

	let { selectedIdx = $bindable(), entries, initial, disabled } = $props();
</script>

<select
	class={buttonVariants({ variant: 'outline' })}
	bind:value={selectedIdx}
	disabled={disabled ?? false}
>
	<option selected={true} value={-1}>{initial}</option>
	{#each entries as c, i}
		<option value={i}>
			{c}
		</option>
	{/each}
</select>
