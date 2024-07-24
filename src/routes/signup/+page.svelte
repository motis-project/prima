<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Input } from '$lib/components/ui/input/index.js';

	import { enhance } from '$app/forms';

	import type { ActionData } from './$types';

	export let form: ActionData;
</script>

<div class="flex min-h-screen">
	<Card.Root class="w-fit m-auto">
		<p>{form?.message ?? ''}</p>
		<Card.Header class="space-y-1">
			<Card.Title class="text-2xl">Neuen Account erstellen</Card.Title>
		</Card.Header>
		<form method="post" use:enhance>
			<Card.Content class="grid gap-4">
				<div class="relative">
					<div class="absolute inset-0 flex items-center">
						<span class="w-full border-t"></span>
					</div>
					<div class="relative flex justify-center text-xs uppercase">
						<span class="bg-card px-2 text-muted-foreground"> oder per E-Mail registrieren </span>
					</div>
				</div>
				<div class="grid gap-2">
					<Label for="email">Email</Label>
					<Input id="email" name="email" type="email" />
				</div>
				<div class="grid gap-2">
					<Label for="password">Password</Label>
					<Input id="password" name="password" type="password" />
				</div>
			</Card.Content>
			<Card.Footer>
				<Button type="submit" class="w-full">Account erstellen</Button>
			</Card.Footer>
		</form>
	</Card.Root>
</div>
