<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import type { ActionData, PageData } from './$types';

	const { data, form } = $props<{ data: PageData; form: ActionData }>();
</script>

<div class="grid grid-rows-2 gap-4">
	{@render assignment()}
	{@render drivers()}
</div>

{#snippet assignment()}
	<Card.Root class="w-5/6 m-2">
		<Card.Header>
			<Card.Title>Fahrer freischalten</Card.Title>
		</Card.Header>
		<Card.Content>
			<form method="POST" action="?/assign">
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
	<Card.Root class="w-5/6 m-2">
		<Card.Header>
			<Card.Title>Aktive Fahrer</Card.Title>
		</Card.Header>
		<Card.Content>
			{#each data.drivers as driver}
				<form method="POST" action="?/revoke">
					<table>
						<tbody>
							<tr>
								<td>{driver.email}</td>
								<td
									><Input
										class="mt-2 invisible"
										hidden={true}
										name="email"
										type="text"
										value={driver.email}
									/></td
								>
								<td>
									{#if data.userEmail != driver.email}
										<Button type="submit">x</Button>
									{/if}
								</td>
							</tr>
						</tbody>
					</table>
				</form>
			{/each}
		</Card.Content>
	</Card.Root>
{/snippet}
