<script lang="ts">
	import { env } from '$env/dynamic/private';
	import { PUBLIC_PROVIDER } from '$env/static/public';
	import EmailFooter from './EmailFooter.svelte';
	const { code } = $props();
</script>

<div>
	Willkommen zu {PUBLIC_PROVIDER},
	<p>
		Bitte aktivieren Sie Ihren Account, indem Sie auf diesen Link klicken:<br />
		<a href="{env.ORIGIN}/account/verify-email/?code={code}" target="_blank">
			{env.ORIGIN}/verify-email/?code={code}
		</a>
	</p>

	<EmailFooter />
</div>
