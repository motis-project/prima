<script lang="ts">
	import { Button } from '$lib/shadcn/button';
	import { Input } from '$lib/shadcn/input';
	import { Label } from '$lib/shadcn/label';
	import ChevronRightIcon from 'lucide-svelte/icons/chevron-right';
	import { enhance } from '$app/forms';
	import Message from '$lib/Message.svelte';
	import Panel from '$lib/Panel.svelte';
	import { t } from '$lib/i18n/translation';
	const { form, data } = $props();
</script>

<Panel
	title="Password Reset"
	subtitle="We sent you a password reset code. Please enter your e-mail address and the code we sent you."
>
	<form method="post" class="flex flex-col gap-6" use:enhance>
		{#if form?.msg}
			<Message class="mb-4" msg={form.msg} />
		{/if}

		<div class="flex flex-col gap-2">
			<Label>{t.account.code}</Label>
			<Input name="code" placeholder="Code" value={data.code} disabled />
		</div>

		<div class="flex flex-col gap-2">
			<Label>E-Mail</Label>
			<Input name="email" placeholder="Email" value={data.email} disabled />
		</div>

		<div class="flex flex-col gap-2">
			<Label>New Password</Label>
			<Input name="password" type="password" placeholder="New Password" />
		</div>

		<Button type="submit" variant="outline">
			Reset Password
			<ChevronRightIcon />
		</Button>
	</form>
</Panel>
