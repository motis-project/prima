<script lang="ts">
	import { PUBLIC_PROVIDER } from '$env/static/public';
	import ChevronRightIcon from 'lucide-svelte/icons/chevron-right';
	import { Button } from '$lib/shadcn/button';
	import { Input } from '$lib/shadcn/input';
	import type { Msg } from '$lib/msg';
	import Message from '$lib/ui/Message.svelte';
	import { t } from '$lib/i18n/translation';
	import { Label } from '$lib/shadcn/label';

	const { msg, type }: { msg?: Msg; type: 'signup' | 'login' } = $props();
</script>

<div class="flex flex-col">
	<form method="post" class="flex flex-col gap-6">
		<Message class="mb-6" {msg} />

		{#if type === 'signup'}
			<div class="field">
				<Label for="name">{t.account.name}</Label>
				<Input name="name" type="text" placeholder={t.account.name} />
			</div>
		{/if}

		<div class="field">
			<Label for="email">{t.account.email}</Label>
			<Input name="email" type="email" placeholder={t.account.email} />
		</div>

		<div class="field">
			<Label for="password">{t.account.password}</Label>
			<Input name="password" type="password" placeholder={t.account.password} />
		</div>

		<Button type="submit" class="w-full" variant="outline">
			{type == 'signup' ? t.account.create : t.account.login}
			<ChevronRightIcon />
		</Button>
	</form>
	<p class="mx-auto mt-8 max-w-72 text-center text-xs text-muted-foreground">
		{#if type == 'signup'}
			Durch die Anmeldung stimme ich den
			<a href="/tos" class="border-b border-dotted border-muted-foreground">
				Allgemeinen&nbsp;Geschäftsbedingen
			</a>
			sowie der
			<a href="/privacy" class="border-b border-dotted border-muted-foreground">
				Datenschutzerklärung
			</a>
			von {PUBLIC_PROVIDER} zu.
		{:else}
			<a
				href="/account/request-password-reset"
				class="border-b border-dotted border-muted-foreground"
			>
				Passwort vergessen?
			</a>
		{/if}
	</p>
</div>
