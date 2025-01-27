<script lang="ts">
	import { t } from '$lib/i18n/translation';
	import { Button } from '$lib/shadcn/button';
	import { Input } from '$lib/shadcn/input';
	import { Label } from '$lib/shadcn/label';
	import Panel from '$lib/ui/Panel.svelte';
	import Message from '$lib/ui/Message.svelte';

	const { form } = $props();
</script>

<Panel title={t.menu.companies} subtitle={t.admin.activateTaxiOwners}>
	{#if form?.msg}
		<Message msg={form.msg} />
	{/if}
	<form method="post">
		<div class="col flex flex-col gap-4">
			<div class="field">
				<Label for="email">{t.account.email}</Label>
				<Input name="email" type="text" placeholder={t.account.email} value={form?.email} />
			</div>
			<div class="flex justify-end">
				<Button type="submit">{t.admin.activateTaxiOwners}</Button>
			</div>
		</div>
	</form>
</Panel>
