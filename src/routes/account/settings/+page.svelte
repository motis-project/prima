<script lang="ts">
	import Panel from '$lib/Panel.svelte';
	import { Button } from '$lib/shadcn/button';
	import { Input } from '$lib/shadcn/input';
	import Message from '$lib/Message.svelte';
	import Meta from '$lib/Meta.svelte';
	import { PUBLIC_PROVIDER } from '$env/static/public';
	import { t } from '$lib/i18n/translation';

	const { form } = $props();
</script>

<Meta title="Account | {PUBLIC_PROVIDER}" />

{#if form?.msg}
	<Message msg={form.msg} class="mb-4" />
{/if}

<div class="flex flex-col gap-10">
	<Panel title={t.account.resetPassword} subtitle={t.account.resetPasswordSubtitle}>
		<form method="post" action="/account/settings?/changePassword">
			<Input name="password" type="password" placeholder="Password" />
			<div class="mt-4 flex justify-end">
				<Button type="submit" variant="outline">{t.account.resetPassword}</Button>
			</div>
		</form>
	</Panel>

	<Panel title={t.account.changeEmail} subtitle={t.account.changeEmailSubtitle}>
		<form method="post" action="/account/settings?/changeEmail" class="mt-8">
			<Input name="email" type="email" placeholder="Email" />
			<div class="mt-4 flex justify-end">
				<Button type="submit" variant="outline">{t.account.changeEmail}</Button>
			</div>
		</form>
	</Panel>

	<Panel title={t.account.logout} subtitle={t.account.logoutSubTitle}>
		<form method="post" action="/account/settings?/logout" class="mt-8">
			<div class="mt-4 flex justify-end">
				<Button type="submit" variant="outline">{t.account.logout}</Button>
			</div>
		</form>
	</Panel>
</div>
