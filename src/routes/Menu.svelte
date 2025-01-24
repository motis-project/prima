<script lang="ts">
	import { page } from '$app/state';
	import ChevronsRight from 'lucide-svelte/icons/chevrons-right';
	import TicketCheck from 'lucide-svelte/icons/ticket-check';
	import UserRound from 'lucide-svelte/icons/user-round';
	import { cubicInOut } from 'svelte/easing';
	import { crossfade } from 'svelte/transition';

	const [send, receive] = crossfade({
		duration: 250,
		easing: cubicInOut
	});
</script>

{#snippet menuItem(name: string, href: string, Icon: typeof ChevronsRight)}
	{@const isActive = page.url.pathname.startsWith(href)}
	<a class="relative m-2 flex flex-col items-center justify-center gap-1 rounded-xl py-6" {href}>
		{#if isActive}
			<div
				class="absolute inset-0 rounded-full bg-muted"
				in:send={{ key: 'activetab' }}
				out:receive={{ key: 'activetab' }}
			></div>
		{/if}
		<div class="relative flex flex-col items-center justify-center">
			<svelte:component this={Icon} class="size-5 shrink-0" />
			{name}
		</div>
	</a>
{/snippet}

<div
	class="fixed bottom-0 grid h-16 w-full grid-cols-3 grid-rows-1 rounded-xl border bg-background text-xs"
>
	{@render menuItem('Verbindungen', '/routing', ChevronsRight)}
	{@render menuItem('Buchungen', '/bookings', TicketCheck)}
	{@render menuItem('Account', '/account/signup', UserRound)}
</div>
