<script lang="ts">
	import '../app.css';

	import ChevronsRight from 'lucide-svelte/icons/chevrons-right';
	import TicketCheck from 'lucide-svelte/icons/ticket-check';
	import UserRound from 'lucide-svelte/icons/user-round';
	import CarTaxiFront from 'lucide-svelte/icons/car-taxi-front';
	import Building2 from 'lucide-svelte/icons/building-2';
	import ListChecks from 'lucide-svelte/icons/list-checks';
	import UsersRound from 'lucide-svelte/icons/users-round';

	import Menu, { type Item as MenuItem } from './Menu.svelte';
	import { t } from '$lib/i18n/translation';

	let { children, data } = $props();

	const baseItems: Array<MenuItem> = [{ title: t.menu.account, href: '/account', Icon: UserRound }];
	const customerItems: Array<MenuItem> = [
		{ title: t.menu.connections, href: '/routing', Icon: ChevronsRight },
		{ title: t.menu.bookings, href: '/bookings', Icon: TicketCheck }
	];
	const taxiOwnerItems: Array<MenuItem> = [
		{ title: t.menu.availability, href: '/taxi/availability', Icon: CarTaxiFront },
		{ title: t.menu.company, href: '/taxi/company', Icon: Building2 },
		{ title: t.menu.completedTours, href: '/taxi/tours', Icon: ListChecks },
		{ title: t.menu.employees, href: '/taxi/members', Icon: UsersRound }
	];
	const adminItems: Array<MenuItem> = [
		{ title: t.menu.completedTours, href: '/admin/tours', Icon: ListChecks },
		{ title: t.menu.companies, href: '/admin/taxi-owners', Icon: CarTaxiFront }
	];

	const items = $derived([
		...(!data.isTaxiOwner && !data.isAdmin ? customerItems : []),
		...(data.isTaxiOwner ? taxiOwnerItems : []),
		...(data.isAdmin ? adminItems : []),
		...baseItems
	]);
</script>

<div class="flex h-full flex-col">
	<div
		id="searchmask-container"
		class="grow overflow-y-auto p-2 pb-6 md:flex md:items-center md:justify-center"
	>
		{@render children()}
	</div>
	<Menu class="shrink" {items} />
</div>
