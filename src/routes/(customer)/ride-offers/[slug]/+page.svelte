<script lang="ts">
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';

	import { Button, buttonVariants } from '$lib/shadcn/button';
	import * as AlertDialog from '$lib/shadcn/alert-dialog';
	import ConnectionDetail from '../../routing/ConnectionDetail.svelte';
	import { goto, pushState } from '$app/navigation';
	import { enhance } from '$app/forms';
	import Message from '$lib/ui/Message.svelte';
	import { msg } from '$lib/msg';
	import { language, t } from '$lib/i18n/translation';
	import * as Card from '$lib/shadcn/card';
	import { Check, MapIcon } from 'lucide-svelte';
	import PopupMap from '$lib/ui/PopupMap.svelte';
	import { page } from '$app/state';
	import Time from '../../routing/Time.svelte';
	import { posToLocation } from '$lib/map/Location';
	import ProfileBadge from '$lib/ui/ProfileBadge.svelte';

	const { data, form } = $props();
	let loading = $state(false);
</script>

<div class="flex h-full flex-col gap-4 md:min-h-[70dvh] md:w-96">
	<div class="flex items-center justify-between gap-4">
		<Button variant="outline" size="icon" onclick={() => window.history.back()}>
			<ChevronLeft />
		</Button>

		{#if !data.cancelled}
			<div class="flex flex-row gap-2">
				{#if new Date(data.journey.startTime).getTime() >= Date.now()}
					<AlertDialog.Root>
						<AlertDialog.Trigger class={buttonVariants({ variant: 'destructive' })}>
							{t.booking.cancel}
						</AlertDialog.Trigger>
						<AlertDialog.Content class="w-[90%]">
							<AlertDialog.Header>
								<AlertDialog.Title>{t.ride.cancelHeadline}</AlertDialog.Title>
								<AlertDialog.Description>
									{t.ride.cancelDescription}
								</AlertDialog.Description>
							</AlertDialog.Header>
							<AlertDialog.Footer class="mt-4">
								<AlertDialog.Cancel>{t.booking.noCancel}</AlertDialog.Cancel>
								<form method="post" use:enhance action="?/cancel">
									<input type="hidden" name="requestId" value={data.id} />
									<AlertDialog.Action>
										{t.ride.cancelTrip}
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

		<Button size="icon" variant="outline" onclick={() => pushState('', { showMap: true })}>
			<MapIcon class="h-[1.2rem] w-[1.2rem]" />
		</Button>
	</div>

	{#if page.state.showMap}
		<PopupMap
			intermediateStops={false}
			itinerary={data.journey}
			from={posToLocation(data.journey.legs[0].from, 0)}
			to={posToLocation(data.journey.legs[data.journey.legs.length - 1].to, 0)}
		/>
	{:else}
		{#if data.negotiating}
			<Message msg={msg('openRequest', 'warning')} />
		{/if}

		<Message msg={form?.msg} />

		<p class="my-2 font-bold">
			{t.booking.itineraryOnDate}
			{new Date(data.journey.startTime).toLocaleDateString(language, {
				weekday: 'long',
				year: 'numeric',
				month: 'numeric',
				day: 'numeric'
			})}
			{t.booking.withVehicle}
			{data.licensePlate ?? t.rideShare.defaultLicensePlate}
		</p>

		{#each data.requests as n}
			<Card.Root class="min-w-72 border-input">
				<Card.Content class="flex flex-col gap-4 p-4">
					<ProfileBadge
						isCustomer={true}
						firstName={n.firstName}
						name={n.name}
						gender={n.gender}
						profilePicture={n.profilePicture}
						smokingAllowed={undefined}
						averageRating={n.averageRatingCustomer}
					/>
					<div class="grid grid-cols-[max-content_auto] gap-x-2">
						<span>{t.account.email}:</span><span><a href="mailto:{n.email}">{n.email}</a></span>
						{#if n.phone}
							<span>{t.account.phone}:</span><span>{n.phone}</span>
						{/if}
					</div>
					<div class="grid grid-cols-[max-content_max-content_auto] gap-x-2">
						<span>{t.from}</span>
						<Time
							variant="schedule"
							class="w-16 font-semibold"
							queriedTime={data.journey.startTime}
							isRealtime={false}
							scheduledTimestamp={n.journey.startTime}
							timestamp={n.journey.startTime}
							fuzzy={true}
						/>
						<span>{n.journey.legs[0].from.name}</span>
						<span>{t.to}</span>
						<Time
							variant="schedule"
							class="w-16 font-semibold"
							queriedTime={data.journey.startTime}
							isRealtime={false}
							scheduledTimestamp={n.journey.endTime}
							timestamp={n.journey.endTime}
							fuzzy={true}
						/>
						<span>{n.journey.legs[0].to.name}</span>
					</div>
					{#if n.requestCancelled}
						<Button type="submit" class="w-full" disabled={true}>
							{t.ride.requestCancelled}
						</Button>
					{:else if n.pending}
						<form
							method="post"
							action="?/accept"
							use:enhance={() => {
								loading = true;
								return async ({ update }) => {
									await update();
									window.setTimeout(() => {
										loading = false;
									}, 5000);
								};
							}}
						>
							<input type="hidden" name="requestId" value={n.id} />
							<Button type="submit" class="w-full" disabled={loading}>
								<Check class="mr-1 size-4" />
								{t.ride.acceptRequest}
							</Button>
						</form>
					{:else}
						<Button type="submit" class="w-full" disabled={true}>
							<Check class="mr-1 size-4" />
							{t.ride.requestAccepted}
						</Button>
					{/if}
				</Card.Content>
			</Card.Root>
		{/each}

		<ConnectionDetail
			itinerary={data.journey}
			onClickStop={(_name: string, stopId: string, time: Date) =>
				goto(`/routing?stopId=${stopId}&time=${time.toISOString()}`)}
			onClickTrip={(tripId: string) => goto(`/routing?tripId=${tripId}`)}
		/>
	{/if}
</div>
