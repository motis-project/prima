<script lang="ts">
	import { Button } from '$lib/shadcn/button';
	import { Input } from '$lib/shadcn/input';
	import Panel from '$lib/ui/Panel.svelte';
	import Message from '$lib/ui/Message.svelte';
	import Meta from '$lib/ui/Meta.svelte';
	import { PUBLIC_PROVIDER } from '$env/static/public';
	import { t } from '$lib/i18n/translation';

	const { form } = $props();
</script>

<Meta title="Account | {PUBLIC_PROVIDER}" />

<Message msg={form?.msg} class="mb-4" />

<div class="flex flex-col gap-10">
	<Panel title={t.account.resetPassword} subtitle={t.account.resetPasswordSubtitle}>
		<form method="post" action="/account/settings?/changePassword">
			<Input name="password" type="password" placeholder={t.account.password} />
			<div class="mt-4 flex justify-end">
				<Button type="submit" variant="outline">{t.account.resetPassword}</Button>
			</div>
		</form>
	</Panel>

	<Panel title={t.account.changeEmail} subtitle={t.account.changeEmailSubtitle}>
		<form method="post" action="/account/settings?/changeEmail" class="mt-8">
			<Input name="email" type="email" placeholder={t.account.email} />
			<div class="mt-4 flex justify-end">
				<Button type="submit" variant="outline">{t.account.changeEmail}</Button>
			</div>
		</form>
	</Panel>

	<Panel title={t.account.logout} subtitle={''}>
		<form method="post" action="/account/settings?/logout" class="mt-8">
			<div class="mt-4 flex justify-end">
				<Button type="submit" variant="outline">{t.account.logout}</Button>
			</div>
		</form>
	</Panel>
</div>
