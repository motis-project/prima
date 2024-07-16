<script>
	import { Plus } from 'lucide-svelte';
	import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { Input } from '$lib/components/ui/input';
	import Label from '$lib/components/ui/label/label.svelte';
	import * as Popover from '$lib/components/ui/popover';
	import { addVehicle } from '$lib/api';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';

	let licensePlate = $state('');
	let passengers = $state('0');
	let bike = $state(false);
	let wheelchair = $state(false);
	let storageSpace = $state(4);
	const pattern = /([A-ZÄÖÜ]{1,3})-([A-ZÄÖÜ]{1,2})-([0-9]{1,4})/;
	const add = async () => {
		if (passengers !== '3' && passengers !== '5' && passengers !== '7') {
			toast.warning('Bitte die maximale Passagieranzahl auswählen.');
		} else if (!pattern.test(licensePlate)) {
			toast.warning('Das Nummernschild ist ungültig!');
		} else if (isNaN(+storageSpace) || storageSpace <= 0 || storageSpace >= 11) {
			toast.warning('Die Anzahl Gepäckstücke muss eine Zahl zwischen 0 und 11 sein.');
		} else {
			try {
				const [ok, response] = await addVehicle(
					licensePlate,
					Number(passengers),
					+wheelchair,
					+bike,
					Number(storageSpace)
				);
				if (!ok) {
					toast(`Server Fehler! Fahrzeug konnte nicht hinzugefügt werden. (${response.message})`);
				}
			} catch {
				toast('Der Server konnte nicht erreicht werden.');
			}
		}
		invalidateAll();
	};
</script>

<div>
	<Popover.Root>
		<Popover.Trigger>
			<Button variant="outline">
				<Plus class="mr-2 h-4 w-4" />
				{'Fahrzeug hinzufügen'}
			</Button>
		</Popover.Trigger>
		<Popover.Content class="absolute z-10">
			<div class="grid gap-4">
				<div class="space-y-2">
					<h2 class="font-medium leading-none">Fahrzeug:</h2>
				</div>
				<div class="grid w-full max-w-sm items-center gap-1.5">
					<Label for="licensePlate">Nummernschild des Fahrzeugs:</Label>
					<Input
						bind:value={licensePlate}
						type="string"
						id="licensePlate"
						placeholder="DA-AB-1234"
					/>
				</div>
				<div>
					<h6>Maximale Passagieranzahl:</h6>
					<RadioGroup.Root bind:value={passengers}>
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="3" id="r1" />
							<Label for="r1">3 Passagiere</Label>
						</div>
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="5" id="r2" />
							<Label for="r2">5 Passagiere</Label>
						</div>
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="7" id="r3" />
							<Label for="r3">7 Passagiere</Label>
						</div>
						<RadioGroup.Input />
					</RadioGroup.Root>
				</div>
				<div class="grid gap-2">
					<div class="flex items-center space-x-2">
						<Checkbox bind:checked={bike} id="bike" aria-labelledby="bike-label" />
						<Label
							id="bike-label"
							for="bike"
							class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
						>
							Fahrradmitnahme
						</Label>
					</div>
					<div class="flex items-center space-x-2">
						<Checkbox
							bind:checked={wheelchair}
							id="wheelchair"
							aria-labelledby="wheelchair-label"
						/>
						<Label
							id="wheelchair-label"
							for="wheelchair"
							class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
						>
							Für Rollstuhlfahrer geeignet
						</Label>
					</div>
					<div class="grid w-full max-w-sm items-center gap-1.5">
						<Label for="gepäckraum">Gepäckstücke:</Label>
						<Input bind:value={storageSpace} type="number" id="gepäckraum" placeholder="4" />
					</div>
					<div class="grid grid-cols-1 items-center gap-4">
						<Button on:click={add} variant="outline">Fahrzeug hinzufügen</Button>
					</div>
				</div>
			</div>
		</Popover.Content>
	</Popover.Root>
</div>
