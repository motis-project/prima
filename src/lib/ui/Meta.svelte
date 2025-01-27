<script lang="ts">
	import { page } from '$app/state';
	import { PUBLIC_PROVIDER } from '$env/static/public';

	export const DEFAULT_SITE_TITLE = PUBLIC_PROVIDER;
	export const DEFAULT_SITE_DESCRIPTION =
		'Wenn kein Bus fährt, kommen Sie bald mit dem ÖPNV-Taxi an Ihr Ziel – fast zum ÖPNV-Tarif. Oder Sie buchen eine private Mitfahrmöglichkeit. Alles direkt in unserer Mobilitätsplattform.';

	const {
		title = DEFAULT_SITE_TITLE,
		description = DEFAULT_SITE_DESCRIPTION,
		type = 'website'
	}: {
		title?: string;
		description?: string;
		type?: string;
	} = $props();
</script>

<svelte:head>
	<!-- Primary Meta Tags -->
	<title>{title}</title>
	<meta name="title" content={title} />
	<meta name="description" content={description} />
	<link rel="canonical" href={page.url.href} />

	<!-- Open Graph / Facebook -->
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content={type} />
	<meta property="og:url" content={page.url.href} />

	<!-- Twitter -->
	<meta property="twitter:title" content={title} />
	<meta property="twitter:description" content={description} />
	<meta property="twitter:url" content={page.url.href} />
</svelte:head>
