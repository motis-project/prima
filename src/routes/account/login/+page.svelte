<script lang="ts">
	import { PUBLIC_PROVIDER } from '$env/static/public';
	import { t } from '$lib/i18n/translation';
	import Meta from '$lib/Meta.svelte';
	import * as Alert from '$lib/shadcn/alert';
	import Form from '../Form.svelte';
	const { form, data } = $props();
</script>

<Meta title="Login | {PUBLIC_PROVIDER}" />

<div>
	<h1 class="my-6 text-center text-2xl font-semibold leading-8 tracking-tight">
		{PUBLIC_PROVIDER}<br />{t.account.login}
	</h1>

	<Alert.Root variant="default" class="my-6">
		{@html t.msg['new']}
	</Alert.Root>

	{#if data.passwordResetSuccess}
		<Alert.Root variant="default" class="my-6">
			{@html t.msg['passwordResetSuccess']}
		</Alert.Root>
	{/if}

	<Form message={form?.msg} type="login" />
</div>
