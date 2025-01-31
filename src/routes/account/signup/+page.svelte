<script lang="ts">
	import { PUBLIC_PROVIDER } from '$env/static/public';
	import Meta from '$lib/ui/Meta.svelte';
	import { t } from '$lib/i18n/translation';
	import Form from '../Form.svelte';

	const { form } = $props();
</script>

<Meta title="{t.account.create} | {PUBLIC_PROVIDER}" />

<div class="md:max-w-80">
	<h1 class="my-6 text-center text-2xl font-semibold leading-8 tracking-tight">
		{t.account.create}
	</h1>
	<Form msg={form?.msg} type="signup" />
</div>
