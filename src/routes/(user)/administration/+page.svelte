<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import type { ActionData, PageData } from './$types';
	import * as Table from '$lib/components/ui/table/index.js';

	const { data, form } = $props<{ data: PageData; form: ActionData }>();
</script>

<div class="w-full h-full">
	<Card.Header>
		<Card.Title>Unternehmer Zugang</Card.Title>
	</Card.Header>
	<Card.Content class="w-full h-full">
		<form class="mb-6" method="POST" action="?/assign">
			<div class=" flex w-full max-w-sm items-center space-x-2">
				<Input name="email" type="email" placeholder="Email" />
				<Button type="submit">Freischalten</Button>
			</div>
			<div
				class="mt-1 ml-1 text-[0.8rem] font-medium"
				class:text-green-600={form?.updated}
				class:text-destructive={form?.incorrect}
				class:text-yellow-600={form?.existed}
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
		<div class="rounded-md border mb-6">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>E-Mail</Table.Head>
						<Table.Head></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.administrators as admin}
						<Table.Row>
							<Table.Cell>{admin.email}</Table.Cell>
							<Table.Cell class="h-16">
								<form method="POST" action="?/revoke" style="display: block !important;">
									<Input
										class="hidden"
										hidden={true}
										name="email"
										type="text"
										value={admin.email}
									/>
									{#if data.userEmail != admin.email}
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
	</Card.Content>
</div>
