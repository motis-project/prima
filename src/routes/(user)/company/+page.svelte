<script lang="ts">
	const { data } = $props();
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import * as Card from '$lib/components/ui/card';
	import { formSchema } from './schema';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { enhance } from '$app/forms';
	import { Toaster, toast } from 'svelte-sonner';

	const form = superForm(data.form, {
		validators: zodClient(formSchema)
	});
	const { form: formData } = form;

	let selectedZone = $state<{
		value: string;
		label: string;
	}>({
		value: $formData.zone,
		label: $formData.zone
	});

	let selectedCommunity = $state<{
		value: string;
		label: string;
	}>({
		value: $formData.community,
		label: $formData.community
	});
</script>

<Toaster />

<div class="w-full h-full">
	<Card.Header>
		<Card.Title>Stammdaten ihres Unternehmens</Card.Title>
	</Card.Header>
	<Card.Content class="w-full h-full">
		<form
			method="POST"
			use:enhance={() => {
				return async ({ update }) => {
					update({ reset: false });
				};
			}}
		>
			<div class="grid w-full grid-rows-3 grid-cols-2 gap-4">
				<Form.Field {form} name="companyname">
					<Form.Control let:attrs>
						<Form.Label>Name</Form.Label>
						<Form.FieldErrors />
						<Input {...attrs} bind:value={$formData.companyname} />
					</Form.Control>
				</Form.Field>
				<Form.Field {form} name="address">
					<Form.Control let:attrs>
						<Form.Label>Unternehmenssitz</Form.Label>
						<Form.FieldErrors />
						<Input {...attrs} bind:value={$formData.address} />
					</Form.Control>
				</Form.Field>
				<Form.Field {form} name="zone">
					<Form.Control let:attrs>
						<Form.Label>Pflichtfahrgebiet</Form.Label>
						<Form.FieldErrors />
						<Select.Root
							selected={selectedZone}
							onSelectedChange={(s) =>
							{
								s && s.label && ($formData.zone = s.label!);
							}}
						>
							<Select.Trigger id="zone">
								<Select.Value placeholder="Bitte auswählen" />
							</Select.Trigger>
							<Select.Content class="absolute z-10">
								{#each data.zones as zone}
									<Select.Item value={zone} label={zone.name.toString()}>
										{zone.name.toString()}
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input hidden bind:value={$formData.zone} name={attrs.name} />
					</Form.Control>
				</Form.Field>
				<Form.Field {form} name="community">
					<Form.Control let:attrs>
						<Form.Label>Gemeinde</Form.Label>
						<Form.FieldErrors />
						<Select.Root
							selected={selectedCommunity}
							onSelectedChange={(s) =>
										{
											s && s.label && ($formData.community = s.label!);
										}}
						>
							<Select.Trigger id="community">
								<Select.Value placeholder="Bitte auswählen" />
							</Select.Trigger>
							<Select.Content class="absolute z-10">
								{#each data.communities as community}
									<Select.Item value={community} label={community.name.toString()}>
										{community.name.toString()}
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input hidden bind:value={$formData.community} name={attrs.name} />
					</Form.Control>
				</Form.Field>
				<div class="mt-6 row-start-3 col-span-2 text-right">
					<Form.Button
						onclick={async () => {
							toast(`Die Daten wurden übernommen.`);
						}}>Übernehmen</Form.Button
					>
				</div>
			</div>
		</form>
	</Card.Content>
</div>
