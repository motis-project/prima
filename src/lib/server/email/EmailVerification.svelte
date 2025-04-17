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
		<br />oder verwenden sie den Code:<br />
	</p>
	<div style="width: 100%;">
		<div
			style="border: 1px solid #d1d5db; padding: 12px 24px; display: inline-block; margin-left: 20px;"
		>
			<p style="margin: 0; font-family: monospace; font-weight: 300;">
				{code}
			</p>
		</div>
	</div>

	<EmailFooter />
</div>
