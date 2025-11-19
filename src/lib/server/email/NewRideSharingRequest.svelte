<script lang="ts">
	import { env } from '$env/dynamic/private';
	import { formatTime } from '$lib/util/formatTime';
	import EmailFooter from './EmailFooter.svelte';
	const {
		journeyTime,
		journeyFirst,
		journeyLast,
		firstEvent,
		lastEvent,
		tourId,
		passengerName,
		passengerMail,
		passengerPhone,
		message
	} = $props();
	const tourLink = $derived(`${env.ORIGIN}/ride-offers/${tourId}`);
</script>

<div>
	Guten Tag,

	<p>
		Es gibt eine neue Anfrage zur Ihrem Mitfahrangebot am {formatTime(journeyTime)} von {journeyFirst}
		nach {journeyLast}:
	</p>
	<ul>
		<li>Von: {firstEvent.address}</li>
		<li>Nach: {lastEvent.address}</li>
		<li>
			Geplanter Start: ~{formatTime(firstEvent.time)}
		</li>
		<li>
			Geplante Ankunft: ~{formatTime(lastEvent.time)}
		</li>
	</ul>

	<ul>
		<li>Name: {passengerName}</li>
		<li>E-Mail: <a href="mailto:{passengerMail}">{passengerMail}</a></li>
		{#if passengerPhone}
			<li>Telefonnummer: {passengerPhone}</li>
		{/if}
		{#if message}
			<li>Nachricht: {message}</li>
		{/if}
	</ul>
	<p>
		Bitte nehmen Sie Kontakt mit der interessierten Person auf. Preis sowie genauer Abholort und
		-zeitpunkt sind noch zu vereinbaren. Wenn Sie sich auf eine Mitnahme einigen, bestätigen Sie
		bitte die am Mitfahrangebot vermerkte Anfrage:
		<a href={tourLink}>{tourLink}</a>
	</p>

	<EmailFooter />
</div>
