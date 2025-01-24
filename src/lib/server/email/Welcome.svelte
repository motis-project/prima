<script lang="ts">
	import { ORIGIN } from '$env/static/private';
	import { PUBLIC_PROVIDER } from '$env/static/public';
	const { code } = $props();
</script>

<div>
	Willkommen zu {PUBLIC_PROVIDER},
	<p>
		Bitte aktiviere Deinen Account, indem Du auf diesen Link klickst:<br />
		<a href="{ORIGIN}/user/verify-email/?code={code}" target="_blank">
			{ORIGIN}/verify-email/?code={code}
		</a>
	</p>
	<p>
		Liebe Grüße<br />
		Dein {PUBLIC_PROVIDER} Team<br />
		<a href={ORIGIN} target="_blank">{ORIGIN}</a><br />
	</p>
</div>
