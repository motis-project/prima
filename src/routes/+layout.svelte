<script lang="ts">
	import '../app.css';
	import Menu, { type Item } from './Menu.svelte';
	import { t } from '$lib/i18n/translation';
	import ChevronsRight from 'lucide-svelte/icons/chevrons-right';
	import TicketCheck from 'lucide-svelte/icons/ticket-check';
	import UserRound from 'lucide-svelte/icons/user-round';
	let { children } = $props();

	const items: Array<Item> = [
		{ title: t.menu.connections, href: '/routing', Icon: ChevronsRight },
		{ title: t.menu.bookings, href: '/bookings', Icon: TicketCheck },
		{ title: t.menu.account, href: '/account', Icon: UserRound }
	];
</script>

<div class="flex h-full flex-col">
	<div class="grow overflow-y-auto p-2 pb-6">
		{@render children()}
	</div>
	<Menu class="shrink" {items} />
</div>
