<script lang="ts">
	import { ORIGIN } from '$env/static/private';
	import { formatTime } from '$lib/util/formatTime';
	import EmailFooter from './EmailFooter.svelte';
	const { firstAddress, lastAddress, firstTime, lastTime, name, tourId } = $props();
	const tourLink = $derived(`${ORIGIN}/taxi/accounting/?tourId=${tourId}`);
</script>

<div>
	Guten Tag {name},

	<p>Es wurde eine neue Buchung angenommen:</p>
	<ul>
		<li>Erster Halt: {firstAddress}</li>
		<li>Letzter Halt: {lastAddress}</li>
		<li>
			Geplanter Start: {formatTime(firstTime)}
		</li>
		<li>
			Geplante Ankunft: {formatTime(lastTime)}
		</li>
	</ul>

	<p>Link zur Fahrt: <a href={tourLink}>{tourLink}</a></p>

	<EmailFooter />
</div>
