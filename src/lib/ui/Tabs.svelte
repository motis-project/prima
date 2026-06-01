<script lang="ts">
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type Item = { label: string; value: number; component: any };
	let { items, activeTabValue = $bindable() }: { items: Item[]; activeTabValue: number } = $props();

	const handleClick = (tabValue: number) => () => (activeTabValue = tabValue);
</script>

<ul class="flex">
	{#each items as item}
		<li>
			<button
				class="rounded-t-md border px-4 py-2
			hover:border-secondary-foreground
			{activeTabValue === item.value
					? ' bg-secondary-foreground text-primary-foreground'
					: ' text-primary-background'}"
				onclick={handleClick(item.value)}>{item.label}</button
			>
		</li>
	{/each}
</ul>
<div class="rounded-md border border-border p-4">
	{#each items as item}
		{#if activeTabValue == item.value}
			<item.component />
		{/if}
	{/each}
</div>
