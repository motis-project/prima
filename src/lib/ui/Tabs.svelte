<script lang="ts">
	const { items } = $props();
	let activeTabValue = $state(1);

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
<div class="overflow-x-auto rounded-md border border-border p-4">
	{#each items as item}
		{#if activeTabValue == item.value}
			<item.component />
		{/if}
	{/each}
</div>
