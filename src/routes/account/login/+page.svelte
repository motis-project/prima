<script lang="ts">
	import { PUBLIC_PROVIDER } from '$env/static/public';
	import { t } from '$lib/i18n/translation';
	import Meta from '$lib/ui/Meta.svelte';
	import * as Alert from '$lib/shadcn/alert';
	import Form from '../Form.svelte';
	import logo from '$lib/assets/logo-alpha.png';
	const { form, data } = $props();
</script>

<Meta title="Login | {PUBLIC_PROVIDER}" />

<div class="md:max-w-80">
	<div class="contents">
		<div class="flex flex-col items-center">
		<img class="w-1/4" src={logo} alt={t.logo} />
		</div>

		<h1 class="my-6 text-center text-2xl font-semibold leading-8 tracking-tight">
			{t.account.login}
		</h1>

		<Alert.Root variant="default" class="my-6">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html t.msg['new']}
		</Alert.Root>

		{#if data.passwordResetSuccess}
			<Alert.Root variant="default" class="my-6">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html t.msg['passwordResetSuccess']}
			</Alert.Root>
		{/if}

		<Form msg={form?.msg} type="login" />
	</div>
</div>
