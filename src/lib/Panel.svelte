<script lang="ts">
	import { Separator } from '$lib/shadcn/separator';
	import { cn } from '$lib/shadcn/utils';
	import type { Snippet } from 'svelte';

	const {
		children,
		class: className,
		title,
		subtitle
	}: {
		children: Snippet;
		class?: string;
		title: string;
		subtitle: string;
	} = $props();
</script>

<div class={cn('w-full space-y-6 rounded-xl pb-6 md:w-[65ch] md:px-8', className)}>
	<div class="space-y-1 text-left">
		<h3 class="text-xl font-medium">{title}</h3>
		<p class="text-sm text-muted-foreground">{subtitle}</p>
	</div>
	<Separator />
	{@render children()}
</div>
