<script lang="ts">
	import { env } from '$env/dynamic/private';
	import { formatTime } from '$lib/util/formatTime';
	import EmailFooter from './EmailFooter.svelte';
	const { licensePlate, departure, arrival, id } = $props();
	const tourLink = $derived(`${env.ORIGIN}/taxi/accounting/?tourId=${id}`);
</script>

<div>
	Guten Tag,

	<p>es steht eine Fahrt bevor:</p>
	<ul>
		<li>
			Fahrzeug: {licensePlate}
		</li>
		<li>
			Abfahrt am Betriebssitz: {formatTime(departure)}
		</li>
		<li>
			Rückkehr zum Betriebssitz: {formatTime(arrival)}
		</li>
	</ul>

	<p>Link zur Fahrt: <a href={tourLink}>{tourLink}</a></p>

	<EmailFooter />
</div>
