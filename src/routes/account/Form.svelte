<script lang="ts">
	import {
		PUBLIC_PROVIDER,
		PUBLIC_TOS_URL,
		PUBLIC_PRIVACY_URL,
		PUBLIC_IMPRINT_URL
	} from '$env/static/public';
	import ChevronRightIcon from 'lucide-svelte/icons/chevron-right';
	import { Button } from '$lib/shadcn/button';
	import { Input } from '$lib/shadcn/input';
	import * as RadioGroup from '$lib/shadcn/radio-group';
	import type { Msg } from '$lib/msg';
	import Message from '$lib/ui/Message.svelte';
	import { t } from '$lib/i18n/translation';
	import { Label } from '$lib/shadcn/label';
	import { enhance } from '$app/forms';

	const { msg, type }: { msg?: Msg; type: 'signup' | 'login' } = $props();
	const isSignup = type === 'signup';
	const requiredField = isSignup ? ' *' : '';
	let showTooltip = $state(false);
</script>

<div class="flex flex-col">
	<form
		method="post"
		class="flex flex-col gap-6"
		use:enhance={() => {
			return async ({ update }) => {
				update({ reset: false });
			};
		}}
	>
		<Message class="mb-6" {msg} />
		{#if isSignup}
			<div class="field">
				<Label for="lastname"
					>{t.account.name}<span class="text-red-500">{requiredField}</span></Label
				>
				<RadioGroup.Root value="o" name="gender" class="grid-cols-3">
					<div class="flex items-center space-x-2">
						<RadioGroup.Item value="m" id="m" />
						<Label for="m">{t.account.gender('m')}</Label>
					</div>
					<div class="flex items-center space-x-2">
						<RadioGroup.Item value="f" id="f" />
						<Label for="f">{t.account.gender('f')}</Label>
					</div>
					<div class="flex items-center space-x-2">
						<RadioGroup.Item value="o" id="o" />
						<Label for="o">{t.account.gender('o')}</Label>
					</div>
				</RadioGroup.Root>
				<div class="grid grid-cols-2 gap-x-1">
					<Input name="firstname" type="text" placeholder={t.account.firstName} />
					<Input name="lastname" type="text" placeholder={t.account.lastName} />
				</div>
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
				<Label for="zipcode"
					>{t.account.zipCode}/{t.account.city}<span class="text-red-500">{requiredField}</span
					></Label
				>
				<div class="grid grid-cols-2 gap-x-1">
					<Input name="zipcode" type="text" placeholder={t.account.zipCode} />
					<Input name="city" type="text" placeholder={t.account.city} />
				</div>
			</div>
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
	<p class="mx-auto mt-6 max-w-72 text-center text-xs text-input">
		<a
			href={PUBLIC_IMPRINT_URL}
			target="_blank"
			class="whitespace-nowrap border-b border-dotted border-input">{t.account.imprint}</a
		>
		|
		<a href={PUBLIC_PRIVACY_URL} class="whitespace-nowrap border-b border-dotted border-input"
			>{t.account.privacy_short}</a
		>
	</p>
</div>
