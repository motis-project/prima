<script lang="ts">
	import { Plus } from 'lucide-svelte';
	import * as RadioGroup from '$lib/shadcn/radio-group';
	import { Input } from '$lib/shadcn/input';
	import Label from '$lib/shadcn/label/label.svelte';
	import * as Popover from '$lib/shadcn/popover';
	import { Button, buttonVariants } from '$lib/shadcn/button';
	import { enhance } from '$app/forms';
	import { t } from '$lib/i18n/translation';
	import * as ToggleGroup from '$lib/shadcn/toggle-group';

	const {
		text,
		useWFit
	}: {
		text: string;
		useWFit?: boolean;
	} = $props();

	let popoverOpen = $state(false);
	let v = $derived(undefined);
	let color: string = $state('#FFFFFF');
	let hasColor = $state(false);
	let model: string = $state('');
	let hasModel = $state(false);
	let smokingOptions = ['nicht erlaubt', 'erlaubt'];
	let smokingAllowed = $state(smokingOptions[0]);
</script>

<Popover.Root bind:open={popoverOpen}>
	<Popover.Trigger
		data-testid={'add-vehicle'}
		class={buttonVariants({
			variant: 'outline',
			class: `${useWFit ? 'w-fit' : `w-32`} justify-start text-left font-normal`
		})}
	>
		{#if v == undefined}
			<Plus class="mr-2 size-4" />
		{/if}
		{text}
	</Popover.Trigger>
	<Popover.Content>
		<form
			method="post"
			action={'?/addVehicle'}
			class="flex flex-col gap-4"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						popoverOpen = false;
					}
					await update({ reset: false });
				};
			}}
		>
			<h2 class="font-medium leading-none">
				{v == undefined ? 'Neues Fahrzeug' : 'Fahrzeug anpassen'}
			</h2>
			<div class="field">
				<Label for="licensePlate">Nummernschild:</Label>
				<Input name="licensePlate" type="string" placeholder="DA-AB-1234" value={undefined} />
			</div>
			<div>
				<h6 class="mb-1">{t.rideShare.maxPassengers}</h6>
				<RadioGroup.Root name="passengers" value={'3'}>
					<div class="flex items-center gap-2">
						<RadioGroup.Item value="3" id="r1" />
						<Label for="r1">1 {t.rideShare.passengers}</Label>
					</div>
					<div class="flex items-center gap-2">
						<RadioGroup.Item value="5" id="r2" />
						<Label for="r2">2 {t.rideShare.passengers}</Label>
					</div>
					<div class="flex items-center gap-2">
						<RadioGroup.Item value="7" id="r3" />
						<Label for="r3">3 {t.rideShare.passengers}</Label>
					</div>
					<div class="flex items-center gap-2">
						<RadioGroup.Item value="7" id="r4" />
						<Label for="r4">4 {t.rideShare.passengers}</Label>
					</div>
				</RadioGroup.Root>
			</div>
			<div class="field">
				<Label for="luggage">Gepäckstücke:</Label>
				<Input name="luggage" type="number" placeholder="4" value={'4'} />
			</div>
			<div>
				<Label for="color">Farbe</Label>
				<div>
					{#if hasColor}
						<Button onclick={() => (hasColor = false)}>Farbe nicht angeben</Button>
						<Input name="color" type="color" bind:value={color} />
					{:else}
						<Button onclick={() => (hasColor = true)}>Farbe angeben</Button>
					{/if}
				</div>
			</div>
			<div>
				<Label for="model">Fahrzeugmodell</Label>
				<div>
					{#if hasModel}
						<Button onclick={() => (hasModel = false)}>Modell nicht angeben</Button>
						<Input name="model" type="string" bind:value={model} />
					{:else}
						<Button onclick={() => (hasModel = true)}>Modell angeben</Button>
					{/if}
				</div>
			</div>
			<div>
				<Label>Rauchen im Fahrzeug</Label>
				<ToggleGroup.Root type="single" bind:value={smokingAllowed}>
					{#each smokingOptions as smokingOption}
						<ToggleGroup.Item value={smokingOption}>{smokingOption}</ToggleGroup.Item>
					{/each}
				</ToggleGroup.Root>
			</div>
			<input type="hidden" name="id" value={undefined} />
			<input type="hidden" name="hasModelString" value={hasColor ? '1' : '0'} />
			<input type="hidden" name="hasColorString" value={hasModel ? '1' : '0'} />
			<input
				type="hidden"
				name="smokingAllowed"
				value={smokingAllowed === smokingOptions[0] ? '0' : '1'}
			/>
			<Button type="submit" variant="outline" data-testid="create-vehicle">
				{v == undefined ? 'Fahrzeug anlegen' : 'Änderungen speichern'}
			</Button>
		</form>
	</Popover.Content>
</Popover.Root>
