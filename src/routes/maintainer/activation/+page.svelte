<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import type { ActionData } from './$types';
	import { onMount } from 'svelte';
	import * as Popover from "$lib/components/ui/popover/index.js";

	export let form: ActionData;
	
	// TODO: sodass das popover gleich offen ist, aber einstellen nur wenn wir von otp kommen
	// TODO: nicht wegklicken können!
	// TODO: mittig platzieren!
	// TODO: felht noch enter button, und serverseitig neues passwort speichern.
	let isOpen = false;
	function togglePopover() {
		isOpen = !isOpen;
	}
	onMount(() => {
		togglePopover();
	});
</script>

<div class="w-full h-full">
	
	<Popover.Root portal={null} open={isOpen}>
		<Popover.Trigger>
		</Popover.Trigger>
		<Popover.Content class="w-80">
		  <div class="grid gap-4">
			<div class="grid gap-2">
				<Label for="email">Email</Label>
				<Input id="email" name="email" type="email" />
			</div>
			<div class="grid gap-2">
				<Label for="password">Password</Label>
				<Input id="password" name="password" type="password" />
			</div>
		  </div>
		</Popover.Content>
	</Popover.Root>

	<Card.Header>
		<Card.Title>Unternehmer freischalten</Card.Title>
	</Card.Header>
	<Card.Content class="w-full h-full">
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
							Freischalten erfolgreich!
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
					<Button type="submit">Unternehmer freischalten</Button>
				</div>
			</div>
		</form>
	</Card.Content>
</div>
