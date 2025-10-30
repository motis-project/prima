<script lang="ts">
	import { env } from '$env/dynamic/private';
	import DisplayCode from './DisplayCode.svelte';
	import EmailFooter from './EmailFooter.svelte';
	const { name = 'user', code, email } = $props();
</script>

<div>
	Hallo {name},
	<p>
		Sie haben eine Zurücksetzung Ihres Passworts beantragt. Bitte benutzen Sie den folgenden Link,
		um ein neues Passwort zu setzen:<br />
		<a href="{env.ORIGIN}/account/reset-password/?code={code}&email={email}" target="_blank">
			{env.ORIGIN}/account/reset-password/?code={code}&email={email}
		</a>
		<br />Alternativ können Sie den Code hier kopieren:<br />
		<DisplayCode {code} />
	</p>
	<p>Falls Sie kein Passwort angefordert haben, können Sie diese E-Mail ignorieren.</p>

	<EmailFooter />
</div>
