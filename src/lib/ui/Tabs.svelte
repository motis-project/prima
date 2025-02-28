<script lang="ts">
	const { items } = $props();
	let activeTabValue = $state(1);

	const handleClick = (tabValue: number) => () => (activeTabValue = tabValue);
</script>

<ul class="flex">
	{#each items as item}
		<li>
			<button class="px-4 py-2 border rounded-t-md
			hover:border-secondary-foreground
			{activeTabValue === item.value ? ' bg-secondary-foreground text-primary-foreground' : ' text-primary-background'}"
			onclick={handleClick(item.value)}>{item.label}</button>
		</li>
	{/each}
</ul>
<div class="border border-border p-4 rounded-md">
	{#each items as item}
		{#if activeTabValue == item.value}
			<item.component />
		{/if}
	{/each}
</div>
