<script lang="ts">
	const { data } = $props();
	import ChevronDown from 'svelte-radix/ChevronDown.svelte';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import * as Card from '$lib/components/ui/card';
	import { formSchema } from './schema';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { enhance } from '$app/forms';
	import { Toaster, toast } from 'svelte-sonner';
	import { buttonVariants } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';

	const form = superForm(data.form, {
		validators: zodClient(formSchema)
	});
	const { form: formData } = form;
</script>

<Toaster />

<div class="w-full h-full">
	<Card.Header>
		<Card.Title>Stammdaten Ihres Unternehmens</Card.Title>
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
						<Input {...attrs} bind:value={$formData.companyname} />
						<Form.FieldErrors />
					</Form.Control>
				</Form.Field>
				<Form.Field {form} name="address">
					<Form.Control let:attrs>
						<Form.Label>Unternehmenssitz</Form.Label>
						<Input {...attrs} bind:value={$formData.address} />
						<Form.FieldErrors />
					</Form.Control>
				</Form.Field>
				<Form.Field {form} name="zone">
					<Form.Control let:attrs>
						<Form.Label>Pflichtfahrgebiet</Form.Label>
						<div class="relative w-full">
							<select
								{...attrs}
								class={cn(
									buttonVariants({ variant: 'outline' }),
									'w-full appearance-none font-normal'
								)}
								bind:value={$formData.zone}
							>
								{#each data.zones as zone}
									<option value={zone.id} selected={$formData.zone == zone.id}>
										{zone.name.toString()}
									</option>
								{/each}
							</select>
							<ChevronDown class="absolute right-3 top-2.5 size-4 opacity-50" />
						</div>
						<Form.FieldErrors />
					</Form.Control>
				</Form.Field>
				<Form.Field {form} name="community">
					<Form.Control let:attrs>
						<Form.Label>Gemeinde</Form.Label>
						<div class="relative w-full">
							<select
								{...attrs}
								class={cn(
									buttonVariants({ variant: 'outline' }),
									'w-full appearance-none font-normal'
								)}
								bind:value={$formData.community}
							>
								{#each data.communities as community}
									<option value={community.id} selected={$formData.community == community.id}>
										{community.name.toString()}
									</option>
								{/each}
							</select>
							<ChevronDown class="absolute right-3 top-2.5 size-4 opacity-50" />
						</div>
						<Form.FieldErrors />
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
