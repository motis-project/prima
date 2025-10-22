<script lang="ts">
	import * as RadioGroup from '$lib/shadcn/radio-group';
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
	import { defaultCarPicture } from '$lib/constants.js';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	const { form } = $props();
	let v = $derived(undefined);
	let color: string = $state('#FFFFFF');
	let hasColor = $state(false);
	let model: string = $state('');
	let hasModel = $state(false);
	let smokingOptions = t.buttons.smokingOptions;
	let smokingAllowed = $state(smokingOptions[0]);
	let lastSmokingAllowed = smokingOptions[0];
	$effect(() => {
		if (smokingAllowed === null || smokingAllowed === '') {
			smokingAllowed = lastSmokingAllowed;
			return;
		}
		if (smokingAllowed !== lastSmokingAllowed) {
			lastSmokingAllowed = smokingAllowed;
		}
	});
	let fromUrl: string | null = null;

	onMount(() => {
		fromUrl = sessionStorage.getItem('lastPage') ?? '/default';
		console.log('Came from:', fromUrl);
	});
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
		action={'?/addVehicle'}
		class="flex flex-col gap-4"
	>
		<h2 class="font-medium leading-none">
			{v == undefined ? t.rideShare.createNewVehicle : 'Fahrzeug anpassen'}
		</h2>
		<Panel title={t.rideShare.licensePlate} subtitle={''}>
			<Input name="licensePlate" type="string" placeholder="DA-AB-1234" value={undefined} />
		</Panel>
		<Panel title={t.rideShare.maxPassengers} subtitle={''}>
			<RadioGroup.Root name="passengers" value={'3'}>
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
		<Panel title={t.rideShare.luggage} subtitle={''}>
			<Input name="luggage" type="number" placeholder="4" value={'4'} />
		</Panel>
		<div>
			<Panel title={t.rideShare.color} subtitle={''}>
				<label for="specifyColor" class="flex items-center gap-2">
					<Checkbox name="specifyColor" bind:checked={hasColor} />
					{t.rideShare.specifyColor}
				</label>
				{#if hasColor}
					<Input type="color" bind:value={color} />
				{/if}
			</Panel>
		</div>
		<div>
			<Panel title={t.rideShare.model} subtitle={''}>
				<label for="specifyModel" class="flex items-center gap-2">
					<Checkbox name="specifyModel" bind:checked={hasModel} />
					{t.rideShare.specifyModel}
				</label>
				{#if hasModel}
					<Input type="string" bind:value={model} />
				{/if}
			</Panel>
		</div>
		<Panel title={t.rideShare.smokingInVehicle} subtitle={''}>
			<ToggleGroup.Root type="single" bind:value={smokingAllowed}>
				{#each smokingOptions as smokingOption}
					<ToggleGroup.Item value={smokingOption}>{smokingOption}</ToggleGroup.Item>
				{/each}
			</ToggleGroup.Root>
		</Panel>
		<input type="hidden" name="id" value={undefined} />
		<input type="hidden" name="color" value={color} />
		<input type="hidden" name="model" value={model} />
		<input type="hidden" name="hasModelString" value={hasModel ? '1' : '0'} />
		<input type="hidden" name="hasColorString" value={hasColor ? '1' : '0'} />
		<input
			type="hidden"
			name="smokingAllowed"
			value={smokingAllowed === smokingOptions[0] ? '0' : '1'}
		/>
		<UploadPhoto name="vehiclePicture" defaultPicture={defaultCarPicture} />
		<Button type="submit" variant="outline" data-testid="create-vehicle">
			{v == undefined ? t.rideShare.createVehicle : t.rideShare.saveChanges}
		</Button>
	</form>
</div>
