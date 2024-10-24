<script lang="ts">
	const { data, form } = $props();
	import ChevronDown from 'svelte-radix/ChevronDown.svelte';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import * as Card from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label/index.js';
	import { buttonVariants } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import ExclamationTriangle from 'svelte-radix/ExclamationTriangle.svelte';
	import * as Alert from '$lib/components/ui/alert/index.js';

	let { name, zone, street, house_number, postal_code, city, community_area } = $state(
		data.company!
	);
</script>

<div class="w-full h-full">
	<Card.Header>
		<Card.Title>Stammdaten Ihres Unternehmens</Card.Title>
	</Card.Header>
	<Card.Content class="w-full h-full">
		{#if form?.error}
			<Alert.Root variant="destructive" class="mb-4">
				<ExclamationTriangle class="h-4 w-4" />
				<Alert.Title>Es ist ein Fehler aufgetreten.</Alert.Title>
				<Alert.Description>{form?.error}</Alert.Description>
			</Alert.Root>
		{/if}

		{#if form?.success}
			<Alert.Root class="mb-4">
				<ExclamationTriangle class="h-4 w-4" />
				<Alert.Title>Aktualisierung erfolgreich.</Alert.Title>
				<Alert.Description>
					Die Stammdaten Ihres Unternehmens wurden aktualisiert.
				</Alert.Description>
			</Alert.Root>
		{/if}

		<form method="POST">
			<div class="grid w-full grid-rows-2 grid-cols-2 gap-6">
				<div>
					<Label for="name">Name</Label>
					<Input name="name" id="name" value={name} />
				</div>
				<div>
					<Label for="street">Straße</Label>
					<Input name="street" id="street" value={street} />
				</div>
				<div>
					<Label for="house_number">Hausnummer</Label>
					<Input name="house_number" id="house_number" value={house_number} />
				</div>
				<div>
					<Label for="city">Stadt</Label>
					<Input name="city" id="city" value={city} />
				</div>
				<div>
					<Label for="postal_code">Postleitzahl</Label>
					<Input name="postal_code" id="postal_code" value={postal_code} />
				</div>
				<div>
					<Label for="zone">Pflichtfahrgebiet</Label>
					<div class="relative w-full">
						<select
							name="zone"
							id="zone"
							class={cn(
								buttonVariants({ variant: 'outline' }),
								'w-full appearance-none font-normal'
							)}
						>
							<option id="zone" selected={!zone} disabled>Pflichtfahrgebiet</option>
							{#each data.zones as z}
								<option id="zone" value={z.id} selected={zone == z.id}>
									{z.name.toString()}
								</option>
							{/each}
						</select>
						<ChevronDown class="absolute right-3 top-2.5 size-4 opacity-50" />
					</div>
				</div>
				<div>
					<Label for="community_area">Gemeinde</Label>
					<div class="relative w-full">
						<select
							name="community_area"
							id="community_area"
							class={cn(
								buttonVariants({ variant: 'outline' }),
								'w-full appearance-none font-normal'
							)}
						>
							<option id="zone" selected={!community_area} disabled>Gemeinde</option>
							{#each data.communities as c}
								<option value={c.id} selected={community_area == c.id}>
									{c.name.toString()}
								</option>
							{/each}
						</select>
						<ChevronDown class="absolute right-3 top-2.5 size-4 opacity-50" />
					</div>
				</div>
			</div>
			<div class="mt-8 w-full text-right">
				<Form.Button>Übernehmen</Form.Button>
			</div>
		</form>
	</Card.Content>
</div>
