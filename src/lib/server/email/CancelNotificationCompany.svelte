<script lang="ts">
	import { getScheduledEventTime } from '$lib/util/getScheduledEventTime';
	import type { TourEvent } from '../db/getTours';
	import EmailFooter from './EmailFooter.svelte';
	const {
		name,
		events,
		departure
	}: {
		name: string;
		events: TourEvent[];
		departure: number;
	} = $props();
	events.sort(
		(e1: TourEvent, e2: TourEvent) => getScheduledEventTime(e1) - getScheduledEventTime(e2)
	);
	console.log('sending cancelation notice mail to company: ', { name }, { events }, { departure });
	const plannedEvents = events.filter((e) => !e.cancelled);
	const startTime = events.length < 2 ? undefined : getScheduledEventTime(events[0]);
	const endTime = events.length < 2 ? undefined : getScheduledEventTime(events[events.length - 1]);
	const today = new Date(Date.now());
	const startDate = startTime == undefined ? undefined : new Date(startTime);
	const endDate = endTime == undefined ? undefined : new Date(endTime);
	const departureDate = new Date(departure);
	const isStartToday =
		new Date(
			departureDate.getUTCFullYear(),
			departureDate.getUTCMonth(),
			departureDate.getUTCDate()
		).getTime() ===
		new Date(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()).getTime();
</script>

<div>
	Guten Tag {name},
	<p>Es gab Stornierungen in der Fahrt</p>
	<ul>
		<li>von {events[0].address}</li>
		<li>nach {events[events.length - 1].address}</li>
	</ul>
	<p>
		die
		{isStartToday ? 'heute' : 'am ' + startDate!.toLocaleDateString('de')} von
		{startDate!.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })} bis
		{endDate!.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })} stattfinden sollte.
	</p>
	{#if plannedEvents.length > 1}
		<p>Die folgenden Halte sind immer noch eingeplant:</p>
		<ul>
			{#each plannedEvents as e}
				<li>
					{new Date(getScheduledEventTime(e)).toLocaleTimeString('de', {
						hour: '2-digit',
						minute: '2-digit'
					})}, {e.address}
				</li>
			{/each}
		</ul>
	{/if}
	<p>Die stornierten Buchungen tauchen immer noch auf, sind nun aber als storniert markiert.</p>
	{#if plannedEvents.length < 2}
		<p>
			Die Fahrt wurde vollständig storniert. Sie finden diese immer noch unter Abrechnung, sie ist
			nun als storniert markiert.
		</p>
	{/if}
	<EmailFooter />
</div>
