<script lang="ts">
	import type { TourEvent } from '$lib/util/getToursTypes';
	import EmailFooter from './EmailFooter.svelte';
	const {
		name,
		newLicensePlate,
		events
	}: {
		name: string;
		newLicensePlate: string;
		events: TourEvent[];
	} = $props();
	events.sort((e1, e2) => e1.communicatedTime - e2.communicatedTime);
	console.log(
		'sending new license plate notice mail to customer: ',
		{ name },
		{ newLicensePlate },
		{ events }
	);
	const startTime = events[0].communicatedTime;
	const endTime = events[events.length - 1].communicatedTime;
	const today = new Date(Date.now());
	const startDate = new Date(startTime);
	const endDate = new Date(endTime);
	const firstEventDate = new Date(events[0].communicatedTime);
	const isStartToday =
		new Date(
			firstEventDate.getUTCFullYear(),
			firstEventDate.getUTCMonth(),
			firstEventDate.getUTCDate()
		).getTime() ===
		new Date(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()).getTime();
</script>

<div>
	Guten Tag {name},
	<p>In der Fahrt</p>
	<ul>
		<li>von {events[0].address}</li>
		<li>nach {events[events.length - 1].address}</li>
	</ul>
	<p>
		die
		{isStartToday ? 'heute' : 'am ' + startDate!.toLocaleDateString('de')} von
		{startDate!.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })} bis
		{endDate!.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })} geplant ist gab es Änderungen.
	</p>
	<p>
		Die Taxifahrt wird von einem anderen Fahrzeug mit dem Kennzeichen {newLicensePlate} durchgeführt.
	</p>
	<EmailFooter />
</div>
