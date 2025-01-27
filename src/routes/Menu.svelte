<script lang="ts">
	import { page } from '$app/state';
	import { cn } from '$lib/shadcn/utils';
	import ChevronsRight from 'lucide-svelte/icons/chevrons-right';
	import { cubicInOut } from 'svelte/easing';
	import { crossfade } from 'svelte/transition';

	export type Item = {
		href: string;
		title: string;
		Icon: typeof ChevronsRight;
	};

	let {
		items,
		class: className
	}: {
		items: Item[];
		class?: string;
	} = $props();

	const [send, receive] = crossfade({
		duration: 250,
		easing: cubicInOut
	});
</script>

{#snippet menuItem(item: Item)}
	{@const isActive = page.url.pathname.startsWith(item.href)}
	<a
		class="relative m-2 flex flex-col items-center justify-center gap-1 rounded-xl py-6"
		href={item.href}
	>
		{#if isActive}
			<div
				class="absolute inset-0 rounded-full bg-muted"
				in:send={{ key: 'activetab' }}
				out:receive={{ key: 'activetab' }}
			></div>
		{/if}
		<div class="relative flex flex-col items-center justify-center">
			<item.Icon class="size-5 shrink-0" />
			{item.title}
		</div>
	</a>
{/snippet}

<div
	class={cn(
		'grid h-16 w-full grid-cols-3 grid-rows-1 rounded-t-xl border-x border-t bg-background text-xs md:hidden',
		className
	)}
>
	{#each items as item}
		{@render menuItem(item)}
	{/each}
</div>
