<script lang="ts">
	import { Button } from '$lib/shadcn/button';
	import { Input } from '$lib/shadcn/input';
	import { Label } from '$lib/shadcn/label';
	import ChevronRightIcon from 'lucide-svelte/icons/chevron-right';
	import { enhance } from '$app/forms';
	import Message from '$lib/ui/Message.svelte';
	import Panel from '$lib/ui/Panel.svelte';
	import { t } from '$lib/i18n/translation';
	const { form, data } = $props();
</script>

<Panel title={t.account.passwordReset} subtitle={t.account.passwordResetSubtitle}>
	<form method="post" class="flex flex-col gap-6" use:enhance>
		<Message class="mb-4" msg={form.msg} />

		<div class="field">
			<Label>{t.account.code}</Label>
			<Input name="code" value={data.code} autocapitalize="off" />
		</div>

		<div class="field">
			<Label>{t.account.email}</Label>
			<Input name="email" value={data.email} autocapitalize="off" />
		</div>

		<div class="field">
			<Label>{t.account.newPassword}</Label>
			<Input name="password" type="password" placeholder="New Password" />
		</div>

		<Button type="submit" variant="outline">
			{t.account.passwordReset}
			<ChevronRightIcon />
		</Button>
	</form>
</Panel>
