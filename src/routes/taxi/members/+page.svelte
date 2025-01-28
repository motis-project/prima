<script lang="ts">
	import { Button } from '$lib/shadcn/button';
	import { Input } from '$lib/shadcn/input';
	import * as Table from '$lib/shadcn/table/index.js';
	import Panel from '$lib/ui/Panel.svelte';
	import { type ActionData } from './$types.js';

	const { data, form } = $props();
</script>

{#snippet manage(
	type: 'Driver' | 'Owner',
	form: NonNullable<ActionData>['driver'] | undefined,
	list: Array<{ email: string }>
)}
	<Panel
		title={type == 'Driver' ? 'Fahrer freischalten' : 'Unternehmensverwaltung'}
		subtitle={type == 'Driver'
			? 'Fahrer für Fahrten mit der Fahrer-App freischalten.'
			: 'Nutzerkonto zur Verwaltung freischalten.'}
	>
		<form
			class="mb-6"
			method="POST"
			action="?/assign{type.charAt(0).toUpperCase() + type.slice(1)}"
		>
			<div class=" flex w-full items-center space-x-2">
				<Input name="email" type="email" placeholder="Email" />
				<Button type="submit">Freischalten</Button>
			</div>
			<div
				class="ml-1 mt-1 text-[0.8rem] font-medium"
				class:text-green-600={form?.updated}
				class:text-destructive={form?.incorrect || form?.missing}
			>
				{#if form?.missing}
					Das Email Feld muss ausgefüllt werden.
				{/if}
				{#if form?.incorrect}
					Nutzer kann nicht freigeschaltet werden.
				{/if}
				{#if form?.updated}
					Freischaltung erfolgreich!
				{/if}
			</div>
		</form>
		{#if list.length !== 0}
			<div class="mb-6 rounded-md border">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>E-Mail</Table.Head>
							<Table.Head></Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each list as member}
							<Table.Row>
								<Table.Cell>{member.email}</Table.Cell>
								<Table.Cell class="h-16">
									<form
										method="POST"
										action="?/revoke{type.charAt(0).toUpperCase() + type.slice(1)}"
										style="display: block !important;"
									>
										<Input
											class="hidden"
											hidden={true}
											name="email"
											type="text"
											value={member.email}
										/>
										{#if data.userEmail != member.email}
											<Button type="submit" variant="destructive">
												Zugang zum Unternehmen löschen
											</Button>
										{/if}
									</form>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</div>
		{/if}
	</Panel>
{/snippet}

<div class="flex flex-col md:w-[96ch] md:flex-row">
	{@render manage('Driver', form?.driver, data.drivers)}
	{@render manage('Owner', form?.owner, data.owners)}
</div>
