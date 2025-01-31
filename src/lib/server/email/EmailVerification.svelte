<script lang="ts">
	import { ORIGIN } from '$env/static/private';
	import { PUBLIC_PROVIDER } from '$env/static/public';
	const { code, name } = $props();
</script>

<div>
	Guten Tag {name},
	<p>
		Bitte verifiziere Deine E-Mail Addresse:<br />
		<a href="{ORIGIN}/account/verify-email/?code={code}" target="_blank">
			{ORIGIN}/verify-email/?code={code}
		</a>
	</p>
	<p>
		Liebe Grüße<br />
		Dein {PUBLIC_PROVIDER} Team<br />
		<a href={ORIGIN} target="_blank">{ORIGIN}</a><br />
	</p>
</div>
