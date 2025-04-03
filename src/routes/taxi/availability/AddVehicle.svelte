<script lang="ts">
	import { Plus } from 'lucide-svelte';
	import Checkbox from '$lib/shadcn/checkbox/checkbox.svelte';
	import * as RadioGroup from '$lib/shadcn/radio-group';
	import { Input } from '$lib/shadcn/input';
	import Label from '$lib/shadcn/label/label.svelte';
	import * as Popover from '$lib/shadcn/popover';
	import { Button, buttonVariants } from '$lib/shadcn/button';
	import { enhance } from '$app/forms';

	const {
		text,
		vehicle,
		width
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
		width?: number;
	} = $props();

	let popoverOpen = $state(false);
	let v = $derived(vehicle);
	let w = $derived(width == undefined ? 'w-fit' : `w-${4 * Math.ceil(width * 0.7)}`);
	console.log({ width });
</script>

<Popover.Root bind:open={popoverOpen}>
	<Popover.Trigger
		data-testid={v?.licensePlate ?? 'add-vehicle'}
		class={buttonVariants({
			variant: 'outline',
			class: `${w} justify-start text-left font-normal`
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
				<Label for="licensePlate">Nummernschild:</Label>
				<Input
					name="licensePlate"
					type="string"
					placeholder="DA-AB-1234"
					value={v?.licensePlate ?? undefined}
				/>
			</div>
			<div>
				<h6 class="mb-1">Maximale Passagieranzahl:</h6>
				<RadioGroup.Root name="passengers" value={v?.passengers?.toString() ?? '3'}>
					<div class="flex items-center gap-2">
						<RadioGroup.Item value="3" id="r1" />
						<Label for="r1">3 Passagiere</Label>
					</div>
					<div class="flex items-center gap-2">
						<RadioGroup.Item value="5" id="r2" />
						<Label for="r2">5 Passagiere</Label>
					</div>
					<div class="flex items-center gap-2">
						<RadioGroup.Item value="7" id="r3" />
						<Label for="r3">7 Passagiere</Label>
					</div>
				</RadioGroup.Root>
			</div>
			<div class="flex flex-col gap-2">
				<div class="flex items-center gap-2">
					<Checkbox checked={(v?.bikes ?? 0) > 0} name="bike" aria-labelledby="bike-label" />
					<Label for="bike" class="text-sm font-medium leading-none">Fahrradmitnahme</Label>
				</div>
				<div class="flex items-center gap-2">
					<Checkbox
						checked={(v?.wheelchairs ?? 0) > 0}
						name="wheelchair"
						aria-labelledby="wheelchair-label"
					/>
					<Label for="wheelchair" class="text-sm font-medium leading-none">
						Für Rollstuhlfahrer geeignet
					</Label>
				</div>
			</div>
			<div class="field">
				<Label for="luggage">Gepäckstücke:</Label>
				<Input name="luggage" type="number" placeholder="4" value={v?.luggage?.toString() ?? '4'} />
			</div>
			<input type="hidden" name="id" value={v?.id} />
			<Button type="submit" variant="outline" data-testid="create-vehicle">
				{v == undefined ? 'Fahrzeug anlegen' : 'Änderungen speichern'}
			</Button>
		</form>
	</Popover.Content>
</Popover.Root>
