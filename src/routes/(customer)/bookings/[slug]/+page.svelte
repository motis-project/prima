<script lang="ts">
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';
	import Waypoints from 'lucide-svelte/icons/waypoints';
	import QrCodeIcon from 'lucide-svelte/icons/qr-code';

	import { Button, buttonVariants } from '$lib/shadcn/button';
	import * as AlertDialog from '$lib/shadcn/alert-dialog';

	import ConnectionDetail from '../../routing/ConnectionDetail.svelte';

	// @ts-expect-error Cannot find module 'svelte-qrcode'
	import QrCode from 'svelte-qrcode';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import Message from '$lib/ui/Message.svelte';
	import { msg } from '$lib/msg';
	import { t } from '$lib/i18n/translation';
	import * as Card from '$lib/shadcn/card';
	import BookingSummary from '$lib/ui/BookingSummary.svelte';
	import { odmPrice } from '$lib/util/odmPrice';

	const { data } = $props();

	let showTicket = $state(false);
</script>

<div class="flex h-full flex-col gap-4 md:min-h-[70dvh] md:w-96">
	{#if !data.cancelled}
		<div class="flex items-center justify-between gap-4">
			<Button variant="outline" size="icon" onclick={() => window.history.back()}>
				<ChevronLeft />
			</Button>

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
				{:else}
					<Button
						onclick={() => {
							showTicket = !showTicket;
						}}
					>
						<QrCodeIcon class="mr-1 size-4" />
						{t.booking.ticket}
					</Button>
				{/if}

				{#if data.communicatedTime >= Date.now()}
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
								<form method="post" use:enhance>
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
		</div>
	{:else}
		<Message msg={msg('cancelled')} />
	{/if}

	{#if showTicket}
		<div class="flex h-full w-full items-center justify-center">
			<div class="flex h-[210px] w-[210px] items-center justify-center bg-white">
				<QrCode value={data.ticketCode} />
			</div>
		</div>
		<Card.Root class="my-2">
			<Card.Content>
				<BookingSummary
					passengers={data.passengers}
					wheelchair={data.wheelchairs !== 0}
					luggage={data.luggage}
					price={odmPrice(data.journey, data.passengers)}
				/>
			</Card.Content>
		</Card.Root>
	{:else}
		<ConnectionDetail
			itinerary={data.journey}
			onClickStop={(_name: string, stopId: string, time: Date) =>
				goto(`/routing?stopId=${stopId}&time=${time.getTime()}`)}
			onClickTrip={(tripId: string) => goto(`/routing?tripId=${tripId}`)}
		/>
	{/if}
</div>
