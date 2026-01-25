<script lang="ts">
	import { Plus } from 'lucide-svelte';
	import Checkbox from '$lib/shadcn/checkbox/checkbox.svelte';
	import * as RadioGroup from '$lib/shadcn/radio-group';
	import { Input } from '$lib/shadcn/input';
	import Label from '$lib/shadcn/label/label.svelte';
	import * as Popover from '$lib/shadcn/popover';
	import { Button, buttonVariants } from '$lib/shadcn/button';
	import { enhance } from '$app/forms';
	import { LICENSE_PLATE_PLACEHOLDER } from '$lib/constants';
	import { t } from '$lib/i18n/translation';

	const {
		text,
		vehicle,
		useWFit
	}: {
		text: string;
		vehicle?: {
			luggage: number;
			licensePlate: string;
			passengers: number;
			wheelchairs: number;
			bikes: number;
			id: number;
		};
		useWFit?: boolean;
	} = $props();

	let popoverOpen = $state(false);
	let v = $derived(vehicle);
</script>

<Popover.Root bind:open={popoverOpen}>
	<Popover.Trigger
		data-testid={v?.licensePlate ?? 'add-vehicle'}
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
			action={v != undefined ? '?/alterVehicle' : '?/addVehicle'}
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
				<Label for="licensePlate_input">Nummernschild:</Label>
				<Input
					name="licensePlate"
					id="licensePlate_input"
					type="string"
					placeholder={LICENSE_PLATE_PLACEHOLDER}
					value={v?.licensePlate ?? undefined}
				/>
			</div>
			<div>
				<Label for="passengers_input">Maximale Passagieranzahl:</Label>
				<Input
					name="passengers"
					id="passengers_input"
					type="number"
					placeholder="4"
					min="1"
					max="8"
					value={v?.passengers?.toString() ?? '3'}
				/>
			</div>
			<div class="flex flex-col gap-2">
				<div class="flex items-center gap-2">
					<Checkbox
						checked={(v?.bikes ?? 0) > 0}
						name="bike"
						id="bike_input"
						aria-labelledby="bike-label"
					/>
					<Label for="bike_input" class="text-sm font-medium leading-none">Fahrradmitnahme</Label>
				</div>
				<div class="flex items-center gap-2">
					<Checkbox
						checked={(v?.wheelchairs ?? 0) > 0}
						name="wheelchair"
						id="wheelchair_input"
						aria-labelledby="wheelchair-label"
					/>
					<Label for="wheelchair_input" class="text-sm font-medium leading-none">
						Mitnahme faltbarer Rollstuhl mit Umsetzung
					</Label>
				</div>
			</div>
			<div class="field">
				<Label for="luggage_input">Gepäckstücke:</Label>
				<Input
					name="luggage"
					id="luggage_input"
					type="number"
					placeholder="4"
					value={v?.luggage?.toString() ?? '4'}
				/>
				<div class="text-sm tracking-tight text-muted-foreground">{t.luggageExplanation}</div>
			</div>
			<input type="hidden" name="id" value={v?.id} />
			<Button type="submit" variant="outline" data-testid="create-vehicle">
				{v == undefined ? 'Fahrzeug anlegen' : 'Änderungen speichern'}
			</Button>
		</form>
	</Popover.Content>
</Popover.Root>
