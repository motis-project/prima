<script lang="ts">
	import { ORIGIN } from '$env/static/private';
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
			Geplanter Start: {new Date(firstTime).toLocaleString('de', {
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			})}
		</li>
		<li>
			Geplante Ankunft: {new Date(lastTime).toLocaleString('de', {
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			})}
		</li>
	</ul>

	<p>Link zur Fahrt: <a href={tourLink}>{tourLink}</a></p>

	<EmailFooter />
</div>
