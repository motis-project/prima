<script lang="ts">
	import { Button } from '$lib/shadcn/button';
	import { Input } from '$lib/shadcn/input';
	import Panel from '$lib/ui/Panel.svelte';
	import Message from '$lib/ui/Message.svelte';
	import Meta from '$lib/ui/Meta.svelte';
	import { PUBLIC_PROVIDER } from '$env/static/public';
	import { t } from '$lib/i18n/translation';

	const { data, form } = $props();
	let showTooltip = $state(false);
</script>

<Meta title="Account | {PUBLIC_PROVIDER}" />

<div class="flex flex-col gap-10">
	<Message msg={form?.msg} class="mb-4" />

	<Panel title={t.account.resetPassword} subtitle={t.account.resetPasswordSubtitle}>
		<form method="post" action="/account/settings?/changePassword">
			<div class="field relative">
				<Input
					name="password"
					type="password"
					placeholder={t.account.newPassword}
					onfocus={() => (showTooltip = true)}
					onblur={() => (showTooltip = false)}
				/>
				{#if showTooltip}
					<div
						class="absolute bottom-full mt-1 w-64 rounded bg-gray-800 p-2 text-xs text-white shadow-lg"
					>
						🔒 Das Passwort muss mindestens 8 Zeichen enthalten.
					</div>
				{/if}
				<div class="mt-4 flex justify-end">
					<Button type="submit" variant="outline">{t.account.resetPassword}</Button>
				</div>
			</div>
		</form>
	</Panel>

	<Panel title={t.account.changeEmail} subtitle={t.account.changeEmailSubtitle}>
		<form method="post" action="/account/settings?/changeEmail" class="mt-8">
			<Input name="email" type="email" placeholder={data.email} />
			<div class="mt-4 flex justify-end">
				<Button type="submit" variant="outline">{t.account.changeEmail}</Button>
			</div>
		</form>
	</Panel>

	<Panel title={t.account.changePhone} subtitle={t.account.changePhoneSubtitle}>
		<form method="post" action="/account/settings?/changePhone" class="mt-8">
			<Input
				name="phone"
				type="phone"
				placeholder={data.phone === null ? t.account.phone : data.phone}
			/>
			<div class="mt-4 flex justify-end">
				<Button type="submit" variant="outline">{t.account.changePhone}</Button>
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
