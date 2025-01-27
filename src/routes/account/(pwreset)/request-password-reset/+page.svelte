<script lang="ts">
	import { Button } from '$lib/shadcn/button';
	import { Input } from '$lib/shadcn/input';
	import { Label } from '$lib/shadcn/label';
	import ChevronRightIcon from 'lucide-svelte/icons/chevron-right';
	import Message from '$lib/ui/Message.svelte';
	import { enhance } from '$app/forms';
	import Panel from '$lib/ui/Panel.svelte';
	import { t } from '$lib/i18n/translation.js';
	const { form } = $props();
</script>

<Panel title={t.account.passwordResetRequest} subtitle={t.account.passwordResetRequestSubtitle}>
	<form method="post" class="flex flex-col gap-6" use:enhance>
		{#if form?.msg}
			<Message class="mb-4" msg={form.msg} />
		{/if}

		<div class="field">
			<Label>{t.account.email}</Label>
			<Input name="email" type="email" placeholder={t.account.email} />
		</div>

		<Button type="submit" class="w-full" variant="outline">
			{t.account.passwordResetRequest}
			<ChevronRightIcon />
		</Button>
	</form>
</Panel>
