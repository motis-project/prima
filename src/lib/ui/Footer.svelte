<script lang="ts">
	import { t } from '$lib/i18n/translation';

	import { PUBLIC_IMPRINT_URL, PUBLIC_PRIVACY_URL } from '$env/static/public';
</script>

<p class="mx-auto max-w-72 pt-6 text-center text-xs text-input">
	<a
		href={PUBLIC_IMPRINT_URL}
		target="_blank"
		class="whitespace-nowrap border-b border-dotted border-input">{t.account.imprint}</a
	>
	|
	<a href={PUBLIC_PRIVACY_URL} class="whitespace-nowrap border-b border-dotted border-input"
		>{t.account.privacyShort}</a
	>
	|
	<a href="/licenses" class="whitespace-nowrap border-b border-dotted border-input"
		>{t.account.dataLicenses}</a
	>
</p>
