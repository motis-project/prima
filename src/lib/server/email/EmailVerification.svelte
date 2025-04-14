<script lang="ts">
	import { ORIGIN } from '$env/static/private';
	import EmailFooter from './EmailFooter.svelte';
	const { code, name } = $props();
</script>

<div>
	Guten Tag {name},
	<p>
		Bitte verifizieren Sie Ihre E-Mail Addresse:<br />
		<a href="{ORIGIN}/account/verify-email/?code={code}" target="_blank">
			{ORIGIN}/verify-email/?code={code}
		</a>
	</p>

	<EmailFooter />
</div>
