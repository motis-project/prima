<script lang="ts">
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';
	import Waypoints from 'lucide-svelte/icons/waypoints';
	import QrCodeIcon from 'lucide-svelte/icons/qr-code';

	import { Button, buttonVariants } from '$lib/shadcn/button';
	import * as AlertDialog from '$lib/shadcn/alert-dialog';

	import ConnectionDetail from '../../routing/ConnectionDetail.svelte';

	// @ts-expect-error Cannot find module 'svelte-qrcode'
	import QrCode from 'svelte-qrcode';
	import { goto, pushState } from '$app/navigation';
	import { enhance } from '$app/forms';
	import Message from '$lib/ui/Message.svelte';
	import { msg } from '$lib/msg';
	import { language, t } from '$lib/i18n/translation';
	import * as Card from '$lib/shadcn/card';
	import BookingSummary from '$lib/ui/BookingSummary.svelte';
	import { MapIcon } from 'lucide-svelte';
	import PopupMap from '$lib/ui/PopupMap.svelte';
	import { page } from '$app/state';
	import { isOdmLeg, isTaxiLeg } from '$lib/util/booking/checkLegType';

	const { data } = $props();

	let showTicket = $state(false);
	const isOdm = data.journey.legs.some(isOdmLeg);
</script>

<div class="flex h-full flex-col gap-4 md:min-h-[70dvh] md:w-96">
	<div class="flex items-center justify-between gap-4">
		<Button variant="outline" size="icon" onclick={() => window.history.back()}>
			<ChevronLeft />
		</Button>

		{#if isOdm}
			{#if !data.cancelled}
				<div class="flex flex-row gap-2">
					{#if showTicket}
						<Button
							onclick={() => {
								showTicket = !showTicket;
							}}
						>
							<Waypoints class="mr-1 size-4" />
							{t.booking.connection}
						</Button>
					{:else if !data.isService && data.journey.legs.some(isTaxiLeg)}
						<Button
							onclick={() => {
								showTicket = !showTicket;
							}}
						>
							<QrCodeIcon class="mr-1 size-4" />
							{t.booking.ticket}
						</Button>
					{/if}

					{#if data.communicatedTime! >= Date.now() && !data.ticketChecked}
						<AlertDialog.Root>
							<AlertDialog.Trigger class={buttonVariants({ variant: 'destructive' })}>
								{t.booking.cancel}
							</AlertDialog.Trigger>
							<AlertDialog.Content class="w-[90%]">
								<AlertDialog.Header>
									<AlertDialog.Title>{t.booking.cancelHeadline}</AlertDialog.Title>
									<AlertDialog.Description>
										{t.booking.cancelDescription}
									</AlertDialog.Description>
								</AlertDialog.Header>
								<AlertDialog.Footer class="mt-4">
									<AlertDialog.Cancel>{t.booking.noCancel}</AlertDialog.Cancel>
									<form method="post" use:enhance action="?/cancel">
										<input type="hidden" name="requestId" value={data.requestId} />
										<AlertDialog.Action>
											{t.booking.cancelTrip}
										</AlertDialog.Action>
									</form>
								</AlertDialog.Footer>
							</AlertDialog.Content>
						</AlertDialog.Root>
					{/if}
				</div>
			{:else}
				<Message msg={msg('cancelled')} />
			{/if}
		{:else}
			<form method="post" action="?/remove" class="flex grow">
				<input type="hidden" name="journeyId" value={data.journeyId} />
				<Button type="submit" class="grow">{t.removeItinerary}</Button>
			</form>
		{/if}
		<Button size="icon" variant="outline" onclick={() => pushState('', { showMap: true })}>
			<MapIcon class="h-[1.2rem] w-[1.2rem]" />
		</Button>
	</div>

	{#if page.state.showMap}
		<PopupMap itinerary={data.journey} />
	{:else if showTicket && isOdm}
		<div class="flex h-full w-full items-center justify-center">
			<div class="flex h-[210px] w-[210px] items-center justify-center bg-white">
				<QrCode value={data.ticketCode} />
			</div>
		</div>
		<Card.Root class="my-2">
			<Card.Content>
				<BookingSummary
					passengers={data.passengers!}
					wheelchair={data.wheelchairs !== 0}
					luggage={data.luggage!}
					price={data.ticketPrice!}
				/>
			</Card.Content>
		</Card.Root>
	{:else}
		{#if data.isService}
			<Card.Root class="my-2">
				<Card.Content>
					<p class="pb-4">{t.booking.pin} <b>{data.ticketCode}</b><br />{t.booking.pinExplainer}</p>
					<BookingSummary
						passengers={data.passengers!}
						wheelchair={data.wheelchairs !== 0}
						luggage={data.luggage!}
						price={data.ticketPrice!}
					/>
				</Card.Content>
			</Card.Root>
		{/if}
		<p class="my-2 font-bold">
			{t.booking.itineraryOnDate}
			{new Date(data.journey.startTime).toLocaleDateString(language, {
				weekday: 'long',
				year: 'numeric',
				month: 'numeric',
				day: 'numeric'
			})}
		</p>
		{#if data.pending}
			<Message msg={msg('stillNegotiating', 'warning')} />
		{/if}
		<ConnectionDetail
			itinerary={data.journey}
			onClickStop={(_name: string, stopId: string, time: Date) =>
				goto(`/routing?stopId=${stopId}&time=${time.toISOString()}`)}
			onClickTrip={(tripId: string) => goto(`/routing?tripId=${tripId}`)}
			licensePlate={data.licensePlate || undefined}
			companyName={data.name || undefined}
			companyPhone={data.phone || undefined}
		/>
	{/if}
</div>
