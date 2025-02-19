<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/shadcn/button';
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';
	import Waypoints from 'lucide-svelte/icons/waypoints';
	import QrCodeIcon from 'lucide-svelte/icons/qr-code';
	import ConnectionDetail from '../../routing/ConnectionDetail.svelte';

	// @ts-expect-error Cannot find module 'svelte-qrcode'
	import QrCode from 'svelte-qrcode';
	import { enhance } from '$app/forms';
	import Message from '$lib/ui/Message.svelte';
	import { msg } from '$lib/msg';

	const { data } = $props();

	let showTicket = $state(false);
</script>

<div class="flex h-full flex-col gap-4 md:h-[80%] md:w-96">
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
						<Waypoints class="mr-1 size-4" />Verbindung
					</Button>
				{:else}
					<Button
						onclick={() => {
							showTicket = !showTicket;
						}}
					>
						<QrCodeIcon class="mr-1 size-4" />Ticket
					</Button>
				{/if}
				<form method="post" use:enhance>
					<input type="hidden" name="requestId" value={data.requestId} />
					<input type="hidden" name="customerId" value={data.customerId} />
					<Button type="submit" variant="destructive">Stornieren</Button>
				</form>
			</div>
		</div>
	{:else}
		<Message msg={msg('cancelled')} />
	{/if}

	{#if showTicket}
		<div class="flex h-full w-full items-center justify-center">
			<QrCode value={data.ticketCode} />
		</div>
	{:else}
		<ConnectionDetail
			itinerary={data.journey}
			onClickStop={(_name: string, stopId: string, time: Date) =>
				goto(`/routing?stopId=${stopId}&time=${time.getTime()}`)}
			onClickTrip={(tripId: string) => goto(`/routing?tripId=${tripId}`)}
		/>
	{/if}
</div>
