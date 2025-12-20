<script lang="ts">
	import { env } from '$env/dynamic/private';
	import { formatTime } from '$lib/util/formatTime';
	import EmailFooter from './EmailFooter.svelte';
	const { licensePlate, id, events } = $props();
	const tourLink = $derived(`${env.ORIGIN}/taxi/accounting/?tourId=${id}`);
	events.sort(
		(e1: { scheduledTimeStart: number }, e2: { scheduledTimeStart: number }) =>
			e1.scheduledTimeStart - e2.scheduledTimeStart
	);
	const firstEvent = events[0];
	const lastEvent = events[events.length - 1];
</script>

<div>
	Guten Tag,

	<p>es steht eine geplante Fahrt bevor:</p>
	<ul>
		<li>
			Fahrzeug: {licensePlate}
		</li>
		<li>Erster Halt: {firstEvent.address}</li>
		<li>Letzter Halt: {lastEvent.address}</li>
		<li>
			Geplanter Start: {formatTime(firstEvent.scheduledTimeStart)}
		</li>
		<li>
			Geplante Ankunft: {formatTime(lastEvent.scheduledTimeStart)}
		</li>
	</ul>

	<p>Link zur Fahrt: <a href={tourLink}>{tourLink}</a></p>

	<EmailFooter />
</div>
