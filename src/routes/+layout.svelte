<script lang="ts">
	import '../app.css';

	import ChevronsRight from 'lucide-svelte/icons/chevrons-right';
	import TicketCheck from 'lucide-svelte/icons/ticket-check';
	import Car from 'lucide-svelte/icons/car';
	import UserRound from 'lucide-svelte/icons/user-round';
	import CarTaxiFront from 'lucide-svelte/icons/car-taxi-front';
	import Building2 from 'lucide-svelte/icons/building-2';
	import UsersRound from 'lucide-svelte/icons/users-round';
	import CircleAlert from 'lucide-svelte/icons/circle-alert';
	import Receipt from 'lucide-svelte/icons/receipt';
	import SlidersVertical from 'lucide-svelte/icons/sliders-vertical';
	import X from 'lucide-svelte/icons/x';

	import * as Alert from '$lib/shadcn/alert';
	import { RIDE_SHARING_COLOR } from '$lib/ui/modeStyle';

	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import Menu, { type Item as MenuItem } from './Menu.svelte';
	import { t } from '$lib/i18n/translation';

	let { children, data } = $props();

	// Disappears on its own after the last day of the campaign (06.09.2026, CEST).
	const CAMPAIGN_BANNER_END = new Date('2026-09-07T00:00:00+02:00').valueOf();
	const CAMPAIGN_BANNER_KEY = 'campaignBannerDismissed:mitfahrwochen2026';
	const CAMPAIGN_BANNER_URL = 'https://www.primaplusoev.de/aktuelles';
	const CAMPAIGN_BANNER_URL_LABEL = CAMPAIGN_BANNER_URL.replace(/^https:\/\/(www\.)?/, '');

	// Session-only: comes back in a new tab or after the browser is closed.
	// Read on the client only, so a dismissed banner never flashes up during hydration.
	let campaignBannerDismissed = $state(
		browser && sessionStorage.getItem(CAMPAIGN_BANNER_KEY) === 'true'
	);
	const showRatingPopup = $derived(!!data.pendingRating);
	const showCampaignBanner = $derived(
		browser &&
			!campaignBannerDismissed &&
			Date.now() < CAMPAIGN_BANNER_END &&
			page.url.pathname === '/routing'
	);

	const dismissCampaignBanner = () => {
		campaignBannerDismissed = true;
		sessionStorage.setItem(CAMPAIGN_BANNER_KEY, 'true');
	};

	const baseItems: Array<MenuItem> = [{ title: t.menu.account, href: '/account', Icon: UserRound }];
	const customerItems: Array<MenuItem> = $derived([
		{ title: t.menu.connections, href: '/routing', Icon: ChevronsRight },
		...(data.isLoggedIn
			? [
					{ title: t.menu.bookings, href: '/bookings', Icon: TicketCheck },
					{ title: t.menu.rideOffers, href: '/ride-offers', Icon: Car }
				]
			: [])
	]);
	const taxiOwnerItems: Array<MenuItem> = [
		{ title: t.menu.accounting, href: '/taxi/accounting', Icon: Receipt },
		{ title: t.menu.availability, href: '/taxi/availability', Icon: CarTaxiFront },
		{ title: t.menu.company, href: '/taxi/company', Icon: Building2 },
		{ title: t.menu.employees, href: '/taxi/members', Icon: UsersRound }
	];
	const adminItems: Array<MenuItem> = [
		{ title: t.menu.accounting, href: '/admin/accounting', Icon: Receipt },
		{ title: t.menu.availability, href: '/taxi/availability', Icon: CarTaxiFront },
		{ title: t.menu.companies, href: '/admin/taxi-owners', Icon: CarTaxiFront },
		{ title: t.menu.calibration, href: '/admin/calibration', Icon: SlidersVertical }
	];

	const items = $derived([
		...(!data.isTaxiOwner && !data.isAdmin ? customerItems : []),
		...(data.isTaxiOwner ? taxiOwnerItems : []),
		...(data.isAdmin ? adminItems : []),
		...baseItems
	]);
</script>

<div class="flex h-full w-full flex-col">
	{#if showCampaignBanner || showRatingPopup || data.pendingRideShareRating}
		<div class="flex flex-col gap-2 px-2 pt-2 md:mx-auto md:w-96 md:px-0">
			{#if showCampaignBanner}
				<Alert.Root
					class="border-transparent text-white [&>svg]:text-white"
					style="background-color: {RIDE_SHARING_COLOR}"
				>
					<button
						class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						onclick={dismissCampaignBanner}
					>
						<X class="size-4" />
						<span class="sr-only">{t.campaignBannerDismiss}</span>
					</button>
					<CircleAlert class="size-4" />
					<Alert.Title></Alert.Title>
					<Alert.Description class="pr-8">
						{t.campaignBannerTitle}<br />
						{t.campaignBannerDescription}<br />
						{t.campaignBannerMoreInfo}
						<a class="break-words font-bold underline" href={CAMPAIGN_BANNER_URL} target="_blank"
							>{CAMPAIGN_BANNER_URL_LABEL}</a
						>
					</Alert.Description>
				</Alert.Root>
			{/if}
			{#if showRatingPopup}
				<Alert.Root>
					<CircleAlert class="size-4" />
					<Alert.Title></Alert.Title>
					<Alert.Description>
						{t.rating.thanksForUsing}<br />
						{t.rating.howHasItBeen}
						<a class="font-bold underline" href="/rating/{data.pendingRating}">
							{t.rating.giveFeedback}
						</a>
					</Alert.Description>
				</Alert.Root>
			{/if}
			{#if data.pendingRideShareRating}
				<Alert.Root>
					<CircleAlert class="size-4" />
					<Alert.Title></Alert.Title>
					<Alert.Description>
						{t.rating.thanksForUsing}<br />
						{t.rideShare.howHasItBeen}
						<a class="font-bold underline" href="/ride-share-rating/{data.pendingRideShareRating}">
							{t.rating.giveFeedback}
						</a>
					</Alert.Description>
				</Alert.Root>
			{/if}
		</div>
	{/if}
	<div class="flex grow flex-col pb-16">
		<div
			id="searchmask-container"
			class="grow overflow-x-auto p-2 py-6 md:mx-auto md:flex md:items-center"
		>
			{@render children()}
		</div>
	</div>
	<Menu {items} />
</div>
