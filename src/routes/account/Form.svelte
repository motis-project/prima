<script lang="ts">
	import { PUBLIC_PROVIDER, PUBLIC_TOS_URL, PUBLIC_PRIVACY_URL } from '$env/static/public';
	import ChevronRightIcon from 'lucide-svelte/icons/chevron-right';
	import { Button } from '$lib/shadcn/button';
	import { Input } from '$lib/shadcn/input';
	import type { Msg } from '$lib/msg';
	import Message from '$lib/ui/Message.svelte';
	import { t } from '$lib/i18n/translation';
	import { Label } from '$lib/shadcn/label';

	const { msg, type }: { msg?: Msg; type: 'signup' | 'login' } = $props();
	const isSignup = type === 'signup';
	const requiredField = isSignup ? ' *' : '';
	let showTooltip = $state(false);
</script>

<div class="flex flex-col">
	<form method="post" class="flex flex-col gap-6">
		<Message class="mb-6" {msg} />
		{#if isSignup}
			<div class="field">
				<Label for="name">{t.account.name}<span class="text-red-500">{requiredField}</span></Label>
				<Input name="name" type="text" placeholder={t.account.name} />
			</div>
		{/if}

		<div class="field">
			<Label for="email">{t.account.email}<span class="text-red-500">{requiredField}</span></Label>
			<Input name="email" type="email" placeholder={t.account.email} />
		</div>

		<div class="field">
			<div class="field relative">
				<Label for="password">
					{t.account.password}<span class="text-red-500">{requiredField}</span>
				</Label>

				<Input
					id="password"
					name="password"
					type="password"
					placeholder={t.account.password}
					onfocus={() => (showTooltip = true)}
					onblur={() => (showTooltip = false)}
				/>

				{#if showTooltip && isSignup}
					<div
						class="absolute bottom-full mt-1 w-64 rounded bg-gray-800 p-2 text-xs text-white shadow-lg"
					>
						🔒 Das Passwort muss mindestens 8 Zeichen enthalten.
					</div>
				{/if}
			</div>
		</div>

		{#if isSignup}
			<div class="field">
				<Label for="phone">{t.account.phone}</Label>
				<Input name="phone" type="phone" placeholder={t.account.phone} />
			</div>
		{/if}

		<Button type="submit" class="w-full" variant="outline">
			{isSignup ? t.account.create : t.account.login}
			<ChevronRightIcon />
		</Button>
	</form>
	<p class="mx-auto mt-8 max-w-72 text-center text-xs text-muted-foreground">
		{#if isSignup}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html t.account.signupConditions(
				`<a href="${PUBLIC_TOS_URL}" target="_blank" class="border-b border-dotted border-muted-foreground whitespace-nowrap">${t.account.tos}</a>`,
				`<a href="${PUBLIC_PRIVACY_URL}" target="_blank" class="border-b border-dotted border-muted-foreground whitespace-nowrap">${t.account.privacy}</a>`,
				PUBLIC_PROVIDER
			)}
		{:else}
			<a
				href="/account/request-password-reset"
				class="border-b border-dotted border-muted-foreground"
			>
				{t.account.forgotPassword}
			</a>
		{/if}
	</p>
</div>
