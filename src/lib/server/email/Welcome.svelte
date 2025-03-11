<script lang="ts">
	import { ORIGIN } from '$env/static/private';
	import { PUBLIC_PROVIDER } from '$env/static/public';
	import EmailFooter from './EmailFooter.svelte';
	const { code } = $props();
</script>

<div>
	Willkommen zu {PUBLIC_PROVIDER},
	<p>
		Bitte aktiviere Deinen Account, indem Du auf diesen Link klickst:<br />
		<a href="{ORIGIN}/account/verify-email/?code={code}" target="_blank">
			{ORIGIN}/verify-email/?code={code}
		</a>
	</p>

	<EmailFooter />
</div>
