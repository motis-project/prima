<script lang="ts">
	import { ORIGIN } from '$env/static/private';
	import EmailFooter from './EmailFooter.svelte';
	const { departure, arrival, name, tourId } = $props();
	const tourLink = $derived(`${ORIGIN}/taxi/tours/?tourId=${tourId}`);
</script>

<div>
	Guten Tag {name},

	<p>Es wurde eine neue Buchung angenommen:</p>

	Fahrt:
	<ul>
		<li>Geplanter Start: {new Date(departure).toLocaleDateString('de')}</li>
		<li>Geplante Ankunft: {new Date(arrival).toLocaleDateString('de')}</li>
	</ul>

	<p>Link zur Fahrt: <a href={tourLink}>{tourLink}</a></p>

	<EmailFooter />
</div>
