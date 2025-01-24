<script lang="ts">
	import { PUBLIC_PROVIDER } from '$env/static/public';
	import Meta from '$lib/Meta.svelte';
	import { t } from '$lib/i18n/translation';
	import Form from '../Form.svelte';

	const { form } = $props();
</script>

<Meta title="{t.account.create} | {PUBLIC_PROVIDER}" />

<div>
	<h1 class="my-6 text-center text-2xl font-semibold leading-7 tracking-tight">
		{PUBLIC_PROVIDER}<br />{t.account.create}
	</h1>
	<Form message={form?.msg} type="signup" />
</div>
