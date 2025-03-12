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
	<p>
		Es gab Stornierungen in der Fahrt von {events[0].address} nach
		{events[events.length - 1].address}, die
		{isStartToday ? 'heute' : 'am ' + startDate!.toLocaleDateString('de')} von
		{startDate!.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })} bis
		{endDate!.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })} stattfinden sollte.
		{events.length < 2
			? 'Die Fahrt wurde vollständig storniert.'
			: 'Die folgenden Halte sind immer noch eingeplant:'}
		{events.map((e) => 'Addresse: ' + e.address + ' Zeit: ' + getScheduledEventTime(e) + '\n')}
		Die stornierten Buchungen tauchen immer noch auf, sind nun aber rot markiert.
		{events.length < 2
			? 'Da die Fahrt vollständig storniert wurde, ist diese ebenfalls rot markiert.'
			: ''}
	</p>

	<EmailFooter />
</div>
