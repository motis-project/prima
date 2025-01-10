<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { ArrowLeft } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	export let form: ActionData;

	const back = () => {
		goto('/login');
	};
</script>

<div class="flex min-h-screen">
	<Card.Root class="w-fit m-auto">
		<p>{form?.message ?? ''}</p>
		<Card.Header class="space-y-1">
			<Card.Title class="text-2xl">Passwort ändern</Card.Title>
			<Card.Description>
				Bitte verwenden Sie dieselbe E-Mail-Adresse wie bei Ihrer Anmeldung.
			</Card.Description>
		</Card.Header>
		<form method="post" use:enhance>
			<Card.Content class="grid gap-4">
				<div class="grid gap-2">
					<Label for="email">Email</Label>
					<Input id="email" name="email" type="email" />
				</div>
				<div class="grid gap-2">
					<Label for="password">Passwort</Label>
					<Input id="password" name="password" type="password" />
				</div>
			</Card.Content>
			<Card.Footer class="grid gap-4 justify-center">
				<Button type="submit">Passwort ändern</Button>
			</Card.Footer>
		</form>
		<div class="grid gap-4 justify-right">
			<Button on:click={back} variant="outline" class="whitespace-pre mb-4 ml-4 mr-4" href="/login">
				<ArrowLeft />zurück
			</Button>
		</div>
	</Card.Root>
</div>
