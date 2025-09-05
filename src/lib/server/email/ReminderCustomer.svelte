<script lang="ts">
	import { env } from '$env/dynamic/private';
	import type { TourEvent } from '$lib/util/getToursTypes';
	import EmailFooter from './EmailFooter.svelte';
	const {
		name,
		licensePlate,
		journeyId,
		events
	}: {
		name: string;
		licensePlate: string;
		journeyId: string;
		events: TourEvent[];
	} = $props();
	events.sort((e1, e2) => e1.communicatedTime - e2.communicatedTime);
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
	const bookingLink = $derived(`${env.ORIGIN}/bookings/${journeyId}`);
</script>

<div>
	Guten Tag {name},
	<p>
		es steht {isStartToday ? 'heute' : 'am ' + startDate!.toLocaleDateString('de')} eine von Ihnen gebuchte
		Fahrt mit PriMa+ÖV bevor:
	</p>
	<ul>
		<li>
			von {events[0].address} um {startDate!.toLocaleTimeString('de', {
				hour: '2-digit',
				minute: '2-digit'
			})}
		</li>
		<li>
			nach {events[events.length - 1].address} gegen {endDate!.toLocaleTimeString('de', {
				hour: '2-digit',
				minute: '2-digit'
			})}
		</li>
		<li>Fahrzeug: {licensePlate}</li>
	</ul>
	<p>Link zur Buchung: <a href={bookingLink}>{bookingLink}</a></p>

	<EmailFooter />
</div>
