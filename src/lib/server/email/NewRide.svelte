<script lang="ts">
	import { ORIGIN } from '$env/static/private';
	import { PUBLIC_PROVIDER } from '$env/static/public';
	const { departure, arrival, name, tourId } = $props();
	const tourLink = $derived(`${ORIGIN}/taxi/tours/?tourId=${tourId}`);
</script>

<div>
	Guten Tag {name},

	<p>Es wurde eine neue Buchung angenommen:</p>

	Fahrt:
	<ul>
		<li>Geplanter Start: {new Date(departure).toLocaleDateString('de')}</li>
		<li>Geplanter Ankunft: {new Date(arrival).toLocaleDateString('de')}</li>
	</ul>

	<p>Link zur Fahrt: <a href={tourLink}>{tourLink}</a></p>

	<p>
		Liebe Grüße<br />
		Ihr {PUBLIC_PROVIDER} Team<br />
		<a href={ORIGIN} target="_blank">{ORIGIN}</a><br />
	</p>
</div>
