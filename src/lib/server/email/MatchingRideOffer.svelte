<script lang="ts">
	import { LOCALE, TZ } from '$lib/constants';
	import EmailFooter from './EmailFooter.svelte';
	const { fromAddress, toAddress, time, name, url } = $props();
</script>

<div>
	Guten Tag {name},

	<p>Es wurde ein Mitfahrangebot passend zu Ihrem Gesuch eingestellt:</p>
	<ul>
		<li>Start: {fromAddress}</li>
		<li>Ziel: {toAddress}</li>
		<li>
			Am: {new Date(time).toLocaleString(LOCALE, {
				day: '2-digit',
				month: '2-digit',
				year: '2-digit',
				timeZone: TZ
			})}
		</li>
	</ul>

	<p>Link zur Suche: <a href={url}>{url}</a></p>

	<EmailFooter />
</div>
