<script lang="ts">
	import Alert from 'lucide-svelte/icons/triangle-alert';
	import ItinerarySummary from '../routing/ItinerarySummary.svelte';
	import { t } from '$lib/i18n/translation';
	import type { Itinerary } from '$lib/openapi';
	import Button from '$lib/shadcn/button/button.svelte';
	import * as Card from '$lib/shadcn/card';
	import DisplayAddresses from '$lib/ui/DisplayAddresses.svelte';
	import AddressTypeahead from '$lib/ui/AddressTypeahead.svelte';
	import type { Location } from '$lib/map/Location';
	import DateInput from '../routing/DateInput.svelte';
	import type { TimeType } from '$lib/util/TimeType';
	import * as RadioGroup from '$lib/shadcn/radio-group';
	import { Bell, Car, Check, Clock, Info, Luggage, Plus, X, Users } from 'lucide-svelte';

	const { data } = $props();
	type Notification = (typeof data.notifications)[number];
	let notificationRows = $state(data.notifications);
	let cancellingNotificationId = $state<number | undefined>(undefined);
	let editingNotificationId = $state<number | undefined>(undefined);
	let savingNotificationId = $state<number | undefined>(undefined);
	let editFrom = $state<Location>();
	let editTo = $state<Location>();
	let editFromItems = $state<Location[]>([]);
	let editToItems = $state<Location[]>([]);
	let editTime = $state(new Date());
	let editTimeType = $state<TimeType>('departure');
	const pastJourneys = data.journeys.filter(
		(j) => j.cancelled || new Date(j.journey.endTime).getTime() < Date.now()
	);
	const plannedJourneys = data.journeys.filter(
		(j) => !j.cancelled && new Date(j.journey.endTime).getTime() >= Date.now()
	);

	async function cancelNotification(notification: Notification) {
		cancellingNotificationId = notification.id;
		try {
			const response = await fetch('/api/addOrRemoveDesiredTrip', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					alertId: notification.id
				})
			});
			if (response.ok) {
				notificationRows = await response.json();
			}
		} finally {
			cancellingNotificationId = undefined;
		}
	}

	function notificationLocation(notification: Notification, type: 'from' | 'to'): Location {
		const lat = type === 'from' ? notification.fromLat : notification.toLat;
		const lon = type === 'from' ? notification.fromLng : notification.toLng;
		const name = type === 'from' ? notification.fromAddress : notification.toAddress;
		return {
			label: name,
			value: {
				match: {
					lat,
					lon,
					level: 0,
					id: '',
					areas: [],
					type: 'PLACE',
					name,
					tokens: [],
					score: 0
				}
			}
		};
	}

	function startEditingNotification(notification: Notification) {
		editingNotificationId = notification.id;
		editFrom = notificationLocation(notification, 'from');
		editTo = notificationLocation(notification, 'to');
		editFromItems = [];
		editToItems = [];
		editTime = new Date(notification.time);
		editTimeType = notification.startFixed ? 'arrival' : 'departure';
	}

	function handleNotificationKeydown(event: KeyboardEvent, notification: Notification) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			startEditingNotification(notification);
		}
	}

	function searchUrl(from: Location, to: Location, time: Date, timeType: TimeType) {
		const params = new URLSearchParams({
			from: JSON.stringify(from.value.match),
			to: JSON.stringify(to.value.match),
			time: time.toISOString(),
			arriveBy: (timeType === 'arrival').toString()
		});
		return `${window.location.origin}/routing?${params.toString()}`;
	}

	async function saveNotification(notification: Notification) {
		const fromMatch = editFrom?.value.match;
		const toMatch = editTo?.value.match;
		if (!editFrom || !editTo || !fromMatch || !toMatch) {
			return;
		}
		savingNotificationId = notification.id;
		try {
			const response = await fetch('/api/addOrRemoveDesiredTrip', {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					alertId: notification.id,
					from: {
						lat: fromMatch.lat,
						lng: fromMatch.lon,
						address: editFrom.label ?? fromMatch.name
					},
					to: {
						lat: toMatch.lat,
						lng: toMatch.lon,
						address: editTo.label ?? toMatch.name
					},
					time: editTime.getTime(),
					startFixed: editTimeType === 'arrival',
					passengers: notification.passengers,
					luggage: notification.luggage,
					url: searchUrl(editFrom, editTo, editTime, editTimeType)
				})
			});
			if (response.ok) {
				notificationRows = await response.json();
				editingNotificationId = undefined;
			}
		} finally {
			savingNotificationId = undefined;
		}
	}
</script>

{#snippet cancelled()}
	<Alert class="size-4" />
	{t.msg.cancelled}
{/snippet}

{#snippet negotiating()}
	<Alert class="size-4" />
	{t.msg.openRequest}
{/snippet}

{#snippet negotiatingAndComitted()}
	<Alert class="size-4" />
	{t.msg.openAndAcceptedRequest}
{/snippet}

{#snippet comitted()}
	<Info class="size-4" />
	{t.msg.acceptedRequest}
{/snippet}

{#snippet notificationInfo()}
	<Bell class="size-4 shrink-0" />
	{t.notificationsList}
{/snippet}

{#snippet plannedJourneysInfo()}
	<Car class="size-4 shrink-0" />
	{t.ride.myRideOffers}
{/snippet}

{#snippet pastJourneysInfo()}
	<Clock class="size-4 shrink-0" />
	{t.cancelledJourneys}
{/snippet}

{#snippet luggageLabel(luggage: number)}
	{#if luggage === 0}
		{t.booking.noLuggage}
	{:else if luggage === 1}
		{t.booking.handLuggage}
	{:else if luggage === 3}
		{t.booking.heavyLuggage}
	{:else}
		{luggage} {t.rideShare.luggage}
	{/if}
{/snippet}

{#snippet notificationList(notifications: Notification[])}
	<div class="flex flex-col gap-4">
		<div
			class="flex items-center gap-1 rounded-lg border border-input bg-accent px-4 py-1.5 text-sm font-medium text-success"
		>
			{@render notificationInfo()}
		</div>
		{#each notifications as notification}
			<Card.Root
				class="min-w-72 cursor-pointer border-input transition-colors hover:bg-accent/40"
				role="button"
				tabindex={0}
				onclick={() => startEditingNotification(notification)}
				onkeydown={(event) => handleNotificationKeydown(event, notification)}
			>
				<Card.Content class="flex flex-col gap-4 p-4">
					<div class="flex items-start justify-between gap-3">
						<span class="min-w-0 break-words text-left">
							<DisplayAddresses
								fromAddress={notification.fromAddress}
								toAddress={notification.toAddress}
							/>
						</span>
						<Button
							variant="destructive"
							size="sm"
							disabled={cancellingNotificationId === notification.id}
							onkeydown={(event) => event.stopPropagation()}
							onclick={(event) => {
								event.stopPropagation();
								cancelNotification(notification);
							}}
						>
							<X class="size-4" />
							{t.booking.cancel}
						</Button>
					</div>
					{#if editingNotificationId === notification.id}
						<div
							class="flex flex-col gap-3"
							role="presentation"
							onclick={(event) => event.stopPropagation()}
							onkeydown={(event) => event.stopPropagation()}
						>
							<AddressTypeahead
								placeholder={t.from}
								bind:selected={editFrom}
								bind:items={editFromItems}
								focus={false}
							/>
							<AddressTypeahead
								placeholder={t.to}
								bind:selected={editTo}
								bind:items={editToItems}
								focus={false}
							/>
							<RadioGroup.Root bind:value={editTimeType} class="grid grid-cols-2 gap-3">
								<label class="flex items-center gap-2 text-sm">
									<RadioGroup.Item value="departure" />
									{t.departure}
								</label>
								<label class="flex items-center gap-2 text-sm">
									<RadioGroup.Item value="arrival" />
									{t.arrival}
								</label>
							</RadioGroup.Root>
							<DateInput bind:value={editTime} />
							<div class="flex justify-end gap-2">
								<Button
									variant="outline"
									size="sm"
									onclick={() => (editingNotificationId = undefined)}
								>
									<X class="size-4" />
									{t.booking.cancel}
								</Button>
								<Button
									size="sm"
									disabled={savingNotificationId === notification.id}
									onclick={() => saveNotification(notification)}
								>
									<Check class="size-4" />
									{t.rideShare.saveChanges}
								</Button>
							</div>
						</div>
					{:else}
						<div class="flex items-center gap-1 text-left text-sm">
							<Clock class="size-4 shrink-0" />
							{t.atDateTime(
								notification.startFixed ? 'arrival' : 'departure',
								new Date(notification.time),
								new Date(notification.time).toLocaleDateString() == new Date().toLocaleDateString()
							)}
						</div>
						<div class="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
							<span class="flex items-center gap-1">
								<Users class="size-4 shrink-0" />
								{t.booking.bookingFor(notification.passengers)}
							</span>
							<span class="flex items-center gap-1">
								<Luggage class="size-4 shrink-0" />
								{@render luggageLabel(notification.luggage)}
							</span>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		{/each}
	</div>
{/snippet}

{#snippet plannedJourneysHeader()}
	<div
		class="flex items-center gap-1 rounded-lg border border-input bg-accent px-4 py-1.5 text-sm font-medium"
	>
		{@render plannedJourneysInfo()}
	</div>
{/snippet}

{#snippet pastJourneysHeader()}
	<div
		class="flex items-center gap-1 rounded-lg border border-input bg-accent px-4 py-1.5 text-sm font-medium text-muted-foreground"
	>
		{@render pastJourneysInfo()}
	</div>
{/snippet}

{#snippet journeyList(
	journeys: {
		journey: Itinerary;
		id: number;
		cancelled: boolean | null;
		negotiating: boolean | null;
		comitted: boolean | null;
	}[]
)}
	<div class="flex flex-col gap-4">
		{#each journeys as it}
			<a href="/ride-offers/{it.id}">
				<ItinerarySummary
					it={it.journey}
					info={it.cancelled
						? cancelled
						: it.negotiating && it.comitted
							? negotiatingAndComitted
							: it.negotiating
								? negotiating
								: it.comitted
									? comitted
									: undefined}
					infoVariant={it.negotiating ? 'text-warning' : it.comitted ? 'text-success' : undefined}
					showAddress={true}
				/>
			</a>
		{/each}
	</div>
{/snippet}

<div class="flex h-full flex-col gap-4 md:min-h-[70dvh] md:w-96">
	<div class="flex items-center justify-between gap-4 pb-8">
		<a href="/ride-offers/new" class="w-full">
			<Button class="w-full">
				<Plus class="mr-1 size-4" />
				{t.ride.create}
			</Button>
		</a>
	</div>
	{#if plannedJourneys.length === 0 && pastJourneys.length === 0}
		{t.noRideOffers}
	{/if}
	{#if notificationRows.length !== 0}
		{@render notificationList(notificationRows)}
	{/if}
	{#if plannedJourneys.length !== 0}
		{@render plannedJourneysHeader()}
		{@render journeyList(plannedJourneys)}
	{/if}
	{#if pastJourneys.length !== 0}
		{@render pastJourneysHeader()}
		{@render journeyList(pastJourneys)}
	{/if}
</div>
