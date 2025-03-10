<script lang="ts">
	import { ORIGIN } from '$env/static/private';
	import EmailFooter from './EmailFooter.svelte';
	const { name = 'user', code, email } = $props();
</script>

<div>
	Hallo {name},
	<p>
		Du hast eine Zurücksetzung Deines Passworts beantragt. Bitte benutze den folgenden Link, um ein
		neues Passwort zu setzen:<br />
		<a href="{ORIGIN}/account/reset-password/?code={code}&email={email}" target="_blank">
			{ORIGIN}/account/reset-password/?code={code}&email={email}
		</a>
	</p>
	<p>Falls Du kein Passwort angefordert hast, kannst Du diese E-Mail ignorieren.</p>

	<EmailFooter />
</div>
