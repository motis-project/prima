<script lang="ts">
	import { Plus } from 'lucide-svelte';
	import Checkbox from '$lib/shadcn/checkbox/checkbox.svelte';
	import * as RadioGroup from '$lib/shadcn/radio-group';
	import { Input } from '$lib/shadcn/input';
	import Label from '$lib/shadcn/label/label.svelte';
	import * as Popover from '$lib/shadcn/popover';
	import { Button, buttonVariants } from '$lib/shadcn/button';
</script>

<Popover.Root>
	<Popover.Trigger
		class={buttonVariants({
			variant: 'outline',
			class: 'w-fit justify-start text-left font-normal'
		})}
	>
		<Plus class="mr-2 size-4" />
		Fahrzeug hinzufügen
	</Popover.Trigger>
	<Popover.Content>
		<form method="post" action="?/addVehicle" class="flex flex-col gap-4">
			<h2 class="font-medium leading-none">Neues Fahrzeug</h2>

			<div class="field">
				<Label for="licensePlate">Nummernschild:</Label>
				<Input name="licensePlate" type="string" placeholder="DA-AB-1234" />
			</div>

			<div>
				<h6 class="mb-1">Maximale Passagieranzahl:</h6>
				<RadioGroup.Root name="nPassengers" value="3">
					<div class="flex items-center gap-2">
						<RadioGroup.Item value="3" />
						<Label for="r1">3 Passagiere</Label>
					</div>
					<div class="flex items-center gap-2">
						<RadioGroup.Item value="5" />
						<Label for="r2">5 Passagiere</Label>
					</div>
					<div class="flex items-center gap-2">
						<RadioGroup.Item value="7" />
						<Label for="r3">7 Passagiere</Label>
					</div>
				</RadioGroup.Root>
			</div>

			<div class="flex flex-col gap-2">
				<div class="flex items-center gap-2">
					<Checkbox name="bike" aria-labelledby="bike-label" />
					<Label for="bike" class="text-sm font-medium leading-none">Fahrradmitnahme</Label>
				</div>

				<div class="flex items-center gap-2">
					<Checkbox name="wheelchair" aria-labelledby="wheelchair-label" />
					<Label for="wheelchair" class="text-sm font-medium leading-none">
						Für Rollstuhlfahrer geeignet
					</Label>
				</div>
			</div>

			<div class="field">
				<Label for="storageSpace">Gepäckstücke:</Label>
				<Input name="storageSpace" type="number" placeholder="4" />
			</div>

			<Button type="submit" variant="outline">Fahrzeug hinzufügen</Button>
		</form>
	</Popover.Content>
</Popover.Root>
