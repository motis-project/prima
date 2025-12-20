<script lang="ts">
	import { env } from '$env/dynamic/private';
	import { PUBLIC_PROVIDER } from '$env/static/public';
	import type { TourEvent } from '$lib/util/getToursTypes';
	import { getEuroString } from '$lib/util/odmPrice';
	import EmailFooter from './EmailFooter.svelte';

	const {
		name,
		licensePlate,
		journeyId,
		ticketCode,
		ticketCodeQr,
		ticketPrice,
		events
	}: {
		name: string;
		licensePlate: string;
		journeyId: string;
		ticketCode: string;
		ticketCodeQr: string;
		ticketPrice: number;
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
		Fahrt mit {PUBLIC_PROVIDER} bevor:
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
	<p>Bitte stornieren Sie die Fahrt rechtzeitig, wenn Sie sie nicht wahrnehmen können.</p>
	<p>Link zur Buchung: <a href={bookingLink}>{bookingLink}</a></p>

	<p><b>Ihr Ticket</b></p>
	<ul>
		<li>
			Preis: {getEuroString(ticketPrice)}
		</li>
	</ul>
	<div>
		<img src={ticketCodeQr} alt={ticketCode} class="qrcode" />
	</div>
	<EmailFooter />
</div>
