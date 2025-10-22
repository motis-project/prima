<script lang="ts">
	import { Button } from '$lib/shadcn/button';
	import { Input } from '$lib/shadcn/input';
	import Panel from '$lib/ui/Panel.svelte';
	import Message from '$lib/ui/Message.svelte';
	import Meta from '$lib/ui/Meta.svelte';
	import { PUBLIC_PROVIDER } from '$env/static/public';
	import { t } from '$lib/i18n/translation';
	import UploadPhoto from '$lib/ui/UploadPhoto.svelte';
	import { goto } from '$app/navigation';
	import { Plus } from 'lucide-svelte';
	import { Label } from '$lib/shadcn/label';
	import * as RadioGroup from '$lib/shadcn/radio-group/index.js';
	import * as Select from '$lib/shadcn/select';
	import { getCountryData, getCountryDataList, type TCountryCode } from 'countries-list';
	import { defaultProfilePicture } from '$lib/constants.js';

	const { data, form } = $props();
	let showTooltip = $state(false);
	let region: TCountryCode | undefined = $state(data.region ? (data.region as TCountryCode) : 'DE');
</script>

<Meta title="Account | {PUBLIC_PROVIDER}" />

<div class="flex flex-col gap-10">
	<Message msg={form?.msg} class="mb-4" />

	<Panel title={t.account.resetPassword} subtitle={t.account.resetPasswordSubtitle}>
		<form method="post" action="/account/settings?/changePassword">
			<Input name="oldPassword" type="password" placeholder={t.account.oldPassword} class="mb-3" />
			<div class="field relative">
				<Input
					name="newPassword"
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

	<Panel title={t.buttons.addVehicleTitle} subtitle={''}>
		<Button variant="outline" onclick={() => goto('/account/add-ride-share-vehicle')}>
			<Plus class="mr-2 size-4" />
			{t.buttons.addVehicle}
		</Button>
	</Panel>

	<Panel title={t.account.profilePicture} subtitle={t.account.profilePictureSubtitle}>
		<form
			method="post"
			action={'/account/settings?/uploadProfilePicture'}
			enctype="multipart/form-data"
			class="mt-8"
		>
			<UploadPhoto
				name="profilePicture"
				displaySaveButton={true}
				currentUrl={data.profilePicture ?? undefined}
				defaultPicture={defaultProfilePicture}
			/>
		</form>
	</Panel>

	<Panel title={t.account.personalInfo} subtitle={t.account.adjustPersonalInfo}>
		<form method="post" action="/account/settings?/personalInfo" class="mt-8 flex flex-col gap-2">
			<Label for="lastname">{t.account.genderString}</Label>
			<RadioGroup.Root value={data.gender ?? 'n'} name="gender" class="grid-cols-4">
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
				<div class="flex items-center space-x-2">
					<RadioGroup.Item value="n" id="n" />
					<Label for="n">{t.account.gender('n')}</Label>
				</div>
			</RadioGroup.Root>
			<Label for="lastname">{t.account.name}</Label>
			<div class="grid grid-cols-2 gap-x-1">
				<Input
					name="firstname"
					type="text"
					value={data.firstName}
					placeholder={t.account.firstName}
				/>
				<Input name="lastname" type="text" value={data.name} placeholder={t.account.lastName} />
			</div>
			<Label for="zipcode">{t.account.zipCode}/{t.account.city}/{t.account.region}</Label>
			<div class="grid grid-cols-2 gap-x-1">
				<Input name="zipcode" type="text" value={data.zipCode} placeholder={t.account.zipCode} />
				<Input name="city" type="text" value={data.city} placeholder={t.account.city} />
			</div>
			<Select.Root type="single" bind:value={region} name="region">
				<Select.Trigger class="overflow-hidden" aria-label={t.account.region}>
					{region ? getCountryData(region).native : t.account.region}
				</Select.Trigger>
				<Select.Content>
					{#each getCountryDataList() as r}
						<Select.Item value={r.iso2} label={r.native}>
							{r.native}
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>

			<div class="mt-2 flex justify-end">
				<Button type="submit" variant="outline">{t.account.updatePersonalInfo}</Button>
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
