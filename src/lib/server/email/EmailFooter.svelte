<script lang="ts">
	import { env } from '$env/dynamic/private';
	import { PUBLIC_PROVIDER } from '$env/static/public';
</script>

<p>
	Viele Grüße<br />
	Ihr {PUBLIC_PROVIDER} Team<br />
	<a href={env.ORIGIN} target="_blank">{env.ORIGIN}</a><br />
</p>
