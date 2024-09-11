<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Table from '$lib/components/ui/table/index.js';
	import { invalidateAll } from '$app/navigation';
	import type { ActionData, PageData } from './$types';

	const { data, form } = $props<{ data: PageData; form: ActionData }>();

	const removeUser = async (email: string) => {
		await fetch('/api/user', {
			method: 'PUT',
			body: JSON.stringify({ email })
		});
		invalidateAll();
	};
</script>

<div class="grid grid-rows-2 gap-4">
	{@render assignment()}
	{@render drivers()}
</div>

{#snippet assignment()}
	<Card.Root class="h-full w-5/6 m-2">
		<Card.Header>
			<Card.Title>Verwalter freischalten</Card.Title>
		</Card.Header>
		<Card.Content>
			<form method="POST">
				<div class="grid w-full grid-rows-2 grid-cols-2 gap-4">
					<Label>
						Email
						{#if form?.missing}
							<div class="text-[0.8rem] font-medium text-destructive mt-1">
								Das Email Feld muss ausgefüllt werden.
							</div>
						{/if}
						{#if form?.incorrect}
							<div class="text-[0.8rem] font-medium text-destructive mt-1">
								Es existiert kein Benutzer mit der angegebenen Emailadresse.
							</div>
						{/if}
						{#if form?.updated}
							<div class="text-[0.8rem] font-medium text-green-600 mt-1">
								Freischaltung erfolgreich!
							</div>
						{/if}
						{#if form?.existed}
							<div class="text-[0.8rem] font-medium text-yellow-700 mt-1">
								Nutzer bereits freigeschaltet
							</div>
						{/if}
						<Input class="mt-2" name="email" type="text" />
					</Label>
					<div class="mt-6 row-start-2 col-span-2 text-right">
						<Button type="submit">Freischalten</Button>
					</div>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
{/snippet}

{#snippet drivers()}
	<Card.Root class="h-full w-5/6 m-2">
		<Card.Header>
			<Card.Title>Inhaber</Card.Title>
		</Card.Header>
		<Card.Content>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Email</Table.Head>
						<Table.Head></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.administrators as admin}
						<Table.Row>
							<Table.Cell>{admin.email}</Table.Cell>
							<Table.Cell class="text-right"
								><Button on:click={() => removeUser(admin.email)}>x</Button></Table.Cell
							>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
{/snippet}
