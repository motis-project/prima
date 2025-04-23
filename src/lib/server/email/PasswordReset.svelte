<script lang="ts">
	import { ORIGIN } from '$env/static/private';
	import DisplayCode from './DisplayCode.svelte';
	import EmailFooter from './EmailFooter.svelte';
	const { name = 'user', code, email } = $props();
</script>

<div>
	Hallo {name},
	<p>
		Sie haben eine Zurücksetzung Ihres Passworts beantragt. Bitte benutzen Sie den folgenden Link,
		um ein neues Passwort zu setzen:<br />
		<a href="{ORIGIN}/account/reset-password/?code={code}&email={email}" target="_blank">
			{ORIGIN}/account/reset-password/?code={code}&email={email}
		</a>
		<br />Alternativ können Sie den Code hier kopieren:<br />
		<DisplayCode {code} />
	</p>
	<p>Falls Sie kein Passwort angefordert haben, können Sie diese E-Mail ignorieren.</p>

	<EmailFooter />
</div>
