<script lang="ts">
	import { Button } from '$lib/shadcn/button';
	import { Input } from '$lib/shadcn/input';
	import { Label } from '$lib/shadcn/label';
	import ChevronRightIcon from 'lucide-svelte/icons/chevron-right';
	import Message from '$lib/Message.svelte';
	import { enhance } from '$app/forms';
	import Panel from '$lib/Panel.svelte';
	const { form } = $props();
</script>

<Panel title="Request Password Reset" subtitle="We will send a reset code to this e-mail.">
	<form method="post" class="flex flex-col gap-6" use:enhance>
		{#if form?.msg}
			<Message class="mb-4" msg={form.msg} />
		{/if}

		<div class="flex flex-col gap-2">
			<Label>E-Mail</Label>
			<Input name="email" type="email" placeholder="Email" />
		</div>

		<Button type="submit" class="w-full" variant="outline">
			Request Reset
			<ChevronRightIcon />
		</Button>
	</form>
</Panel>
