<script lang="ts">
	import * as RadioGroup from '$lib/shadcn/radio-group';
	import { Select, SelectTrigger, SelectContent } from '$lib/shadcn/select';
	import { Input } from '$lib/shadcn/input';
	import Label from '$lib/shadcn/label/label.svelte';
	import { Button } from '$lib/shadcn/button';
	import { t } from '$lib/i18n/translation';
	import * as ToggleGroup from '$lib/shadcn/toggle-group';
	import UploadPhoto from '$lib/ui/UploadPhoto.svelte';
	import Message from '$lib/ui/Message.svelte';
	import Checkbox from '$lib/shadcn/checkbox/checkbox.svelte';
	import Panel from '$lib/ui/Panel.svelte';
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';
	import { LICENSE_PLATE_PLACEHOLDER } from '$lib/constants.js';
	import { defaultCarPicture } from '$lib/constants.js';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { Msg } from '$lib/msg';
	import type { CountryKey } from '@codecorn/euro-plate-validator';
	import {
		validatePlate,
		supportedCountries,
		getInputMask,
		DISPLAY_FORMATS
	} from '@codecorn/euro-plate-validator';
	import SelectItem from '$lib/shadcn/select/select-item.svelte';

	const {
		form,
		luggage,
		passengers,
		licensePlate,
		model,
		color,
		vehiclePicturePath,
		smokingAllowed,
		vehicleId,
		country
	}: {
		form: { msg?: Msg } | null;
		luggage?: number;
		passengers?: number;
		color?: string | null;
		model?: string | null;
		smokingAllowed?: boolean;
		licensePlate?: string | null;
		vehiclePicturePath?: string | null;
		vehicleId?: number;
		country?: CountryKey;
	} = $props();
	const isEditMode = luggage !== undefined;
	const action = !isEditMode ? '?/addVehicle' : '?/editVehicle';
	let newColor: string = $state(color ?? '#FFFFFF');
	let hasColor = $state(color !== undefined && color !== null);
	let newModel: string = $state(model ?? '');
	let hasModel = $state(model !== undefined && model !== null);
	let smokingOptions = t.buttons.smokingOptions;
	let newCountry = $state<CountryKey>(country ?? 'DE');
	const smokingAllowedString: string | undefined =
		smokingAllowed === undefined
			? undefined
			: smokingAllowed
				? smokingOptions[1]
				: smokingOptions[0];
	let newSmokingAllowed = $state(smokingAllowedString ?? smokingOptions[0]);
	let lastSmokingAllowed = smokingAllowedString ?? smokingOptions[0];
	$effect(() => {
		if (newSmokingAllowed === null || newSmokingAllowed === '') {
			newSmokingAllowed = lastSmokingAllowed;
			return;
		}
		if (newSmokingAllowed !== lastSmokingAllowed) {
			lastSmokingAllowed = newSmokingAllowed;
		}
	});
	let fromUrl: string | null = null;

	onMount(() => {
		fromUrl = sessionStorage.getItem('lastPage') ?? '/default';
		console.log('Came from:', fromUrl);
	});

	let loading = $state(false);
</script>

<div>
	<Button
		class="mb-2"
		size="icon"
		variant="outline"
		onclick={() => (fromUrl === null ? history.back() : goto(fromUrl!))}
	>
		<ChevronLeft />
	</Button>
	<Message msg={form?.msg} class="mb-4" />
	<form
		enctype="multipart/form-data"
		method="post"
		{action}
		class="flex flex-col gap-4"
		onsubmit={() => {
			loading = true;
		}}
	>
		<h2 class="font-semibold">
			{!isEditMode ? t.rideShare.createNewVehicle : t.rideShare.editVehicle}
		</h2>
		<Panel title={t.rideShare.licensePlate} subtitle={''}>
			<div class="flex flex-row gap-2">
				<div class="w-fit">
					<Select type="single" bind:value={newCountry}>
						<SelectTrigger>
							{newCountry}
						</SelectTrigger>
						<SelectContent>
							{#each supportedCountries as c}
								<SelectItem value={c}>
									{c}
								</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				</div>
				<Input
					name="licensePlate"
					type="string"
					placeholder={DISPLAY_FORMATS[newCountry]}
					value={licensePlate ?? undefined}
				/>
			</div>
		</Panel>
		<Panel title={t.rideShare.maxPassengers} subtitle={''}>
			<RadioGroup.Root name="passengers" value={passengers?.toString() ?? '3'}>
				<div class="flex items-center gap-2">
					<RadioGroup.Item value="1" id="r1" />
					<Label for="r1">1 {t.rideShare.passengers}</Label>
				</div>
				<div class="flex items-center gap-2">
					<RadioGroup.Item value="2" id="r2" />
					<Label for="r2">2 {t.rideShare.passengers}</Label>
				</div>
				<div class="flex items-center gap-2">
					<RadioGroup.Item value="3" id="r3" />
					<Label for="r3">3 {t.rideShare.passengers}</Label>
				</div>
				<div class="flex items-center gap-2">
					<RadioGroup.Item value="4" id="r4" />
					<Label for="r4">4 {t.rideShare.passengers}</Label>
				</div>
			</RadioGroup.Root>
		</Panel>
		<Panel title={t.rideShare.luggage} subtitle={t.rideShare.luggageExplanation}>
			<Input name="luggage" type="number" placeholder="4" value={luggage ?? '4'} />
		</Panel>
		<div>
			<Panel title={t.rideShare.color} subtitle={''}>
				<label for="specifyColor" class="flex items-center gap-2">
					<Checkbox name="specifyColor" id="specifyColor" bind:checked={hasColor} />
					{t.rideShare.specifyColor}
				</label>
				{#if hasColor}
					<Input type="color" bind:value={newColor} />
				{/if}
			</Panel>
		</div>
		<div>
			<Panel title={t.rideShare.model} subtitle={''}>
				<label for="specifyModel" class="flex items-center gap-2">
					<Checkbox name="specifyModel" id="specifyModel" bind:checked={hasModel} />
					{t.rideShare.specifyModel}
				</label>
				{#if hasModel}
					<Input type="string" bind:value={newModel} />
				{/if}
			</Panel>
		</div>
		<Panel title={t.rideShare.smokingInVehicle} subtitle={''}>
			<ToggleGroup.Root type="single" bind:value={newSmokingAllowed}>
				{#each smokingOptions as smokingOption}
					<ToggleGroup.Item value={smokingOption}>{smokingOption}</ToggleGroup.Item>
				{/each}
			</ToggleGroup.Root>
		</Panel>
		<Panel title={t.rideShare.vehiclePhoto} subtitle={''}>
			<UploadPhoto name="vehiclePicture" defaultPicture={vehiclePicturePath ?? defaultCarPicture} />
		</Panel>
		<Message msg={form?.msg} class="mb-4" />

		<Button type="submit" variant="outline" data-testid="create-vehicle" disabled={loading}>
			{!isEditMode ? t.rideShare.createVehicle : t.rideShare.saveChanges}
		</Button>

		<input type="hidden" name="id" value={undefined} />
		<input type="hidden" name="color" value={newColor} />
		<input type="hidden" name="model" value={newModel} />
		<input type="hidden" name="hasModelString" value={hasModel ? '1' : '0'} />
		<input type="hidden" name="hasColorString" value={hasColor ? '1' : '0'} />
		<input
			type="hidden"
			name="smokingAllowed"
			value={newSmokingAllowed === smokingOptions[0] ? '0' : '1'}
		/>
		<input type="hidden" name="vehicleId" value={vehicleId} />
		<input type="hidden" name="country" value={newCountry} />
	</form>
</div>
