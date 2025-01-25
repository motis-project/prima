<script lang="ts">
	import { Label } from '$lib/shadcn/label';
	import { Input } from '$lib/shadcn/input';
	import { Button } from '$lib/shadcn/button';
	import Meta from '$lib/Meta.svelte';
	import Message from '$lib/Message.svelte';
	import Panel from '$lib/Panel.svelte';
	import { t } from '$lib/i18n/translation.js';

	const { data, form } = $props();
</script>

<Meta title="E-Mail Verification | triptix.tech" />

<Panel title={t.account.emailVerification} subtitle={t.account.verifySubtitle}>
	<div class="flex flex-col">
		<div class="prose mb-8 max-w-none dark:prose-invert">
			<p>
				{t.account.sentAnEmailTo} <b>{data.email}</b>.<br />
			</p>
			<p>
				{@html t.account.changeYourEmail}
			</p>
		</div>

		<form method="post">
			{#if form?.msg}
				<Message msg={form.msg} class="mb-6" />
			{/if}
			<div class="field">
				<Label for="form-verify.code">Code</Label>
				<Input id="form-verify.code" name="code" value={data.code} />
			</div>
			<div class="mt-6 flex justify-end gap-4 text-xs md:text-base">
				<Button type="submit" variant="outline" formaction="?/resend">Resend code</Button>
				<Button type="submit" formaction="?/verify">Verify</Button>
			</div>
		</form>
	</div>
</Panel>
