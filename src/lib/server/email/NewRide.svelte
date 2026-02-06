<script lang="ts">
	import { env } from '$env/dynamic/private';
	import { formatTime } from '$lib/util/formatTime';
	import EmailFooter from './EmailFooter.svelte';
	const { firstEvent, lastEvent, name, tourId } = $props();
	const tourLink = $derived(`${env.ORIGIN}/taxi/accounting/?tourId=${tourId}`);
</script>

<div>
	Guten Tag {name},

	<p>Es wurde eine neue Buchung angenommen:</p>
	<ul>
		<li>Erster Halt: {firstEvent.address}</li>
		<li>Letzter Halt: {lastEvent.address}</li>
		<li>
			Geplanter Start: {formatTime(firstEvent.time)}
		</li>
		<li>
			Geplante Ankunft: {formatTime(lastEvent.time)}
		</li>
	</ul>

	<p>Link zur Fahrt: <a href={tourLink}>{tourLink}</a></p>

	<EmailFooter />
</div>
