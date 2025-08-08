<script lang="ts">
	import { env } from '$env/dynamic/private';
	import DisplayCode from './DisplayCode.svelte';
	import EmailFooter from './EmailFooter.svelte';
	const { code, name } = $props();
</script>

<div>
	Guten Tag {name},
	<p>
		Bitte verifizieren Sie Ihre E-Mail Addresse:<br />
		<a href="{env.ORIGIN}/account/verify-email/?code={code}" target="_blank">
			{env.ORIGIN}/verify-email/?code={code}
		</a>
		<br />oder verwenden sie den Code:<br />
	</p>
	<DisplayCode {code} />

	<EmailFooter />
</div>
