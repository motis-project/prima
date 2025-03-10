<script lang="ts">
	import { getScheduledEventTime } from '$lib/util/getScheduledEventTime';
	import type { TourEvent } from '../db/getTours';
	import EmailFooter from './EmailFooter.svelte';
	const {
		name,
		events
	}: {
		name: string;
		events: TourEvent[];
	} = $props();
	events.sort(
		(e1: TourEvent, e2: TourEvent) => getScheduledEventTime(e1) - getScheduledEventTime(e2)
	);
	const startTime = getScheduledEventTime(events[0]);
	const endTime = getScheduledEventTime(events[events.length - 1]);
	const startDate = new Date(startTime);
	const endDate = new Date(endTime);
	const today = new Date(Date.now());
	const isStartToday =
		new Date(
			startDate.getUTCFullYear(),
			startDate.getUTCMonth(),
			startDate.getUTCDate()
		).getTime() ===
		new Date(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()).getTime();
</script>

<div>
	Guten Tag {name},
	<p>
		Es gab Stornierungen in der Fahrt von {events[0].address} nach {events[events.length - 1]
			.address}, die {isStartToday ? 'heute' : 'am ' + startDate.toLocaleDateString('de')} von {startDate.toLocaleTimeString(
			'de'
		)} bis {endDate.toLocaleTimeString('de')} stattfinden sollte.
		{events.length === 0
			? 'Die Fahrt wurde vollständig storniert.'
			: 'Die folgenden Halte sind immer noch eingeplant:'}
		{events.map((e) => 'Addresse: ' + e.address + ' Zeit: ' + getScheduledEventTime(e) + '\n')}
		Die stornierten Buchungen tauchen immer noch auf, sind nun aber rot markiert.
		{events.length === 0
			? 'Da die Fahrt vollständig storniert wurde, ist diese ebenfalls rot markiert.'
			: ''}
	</p>

	<EmailFooter />
</div>
