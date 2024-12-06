<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
</script>

<div class="flex min-h-screen">
	<Card.Root class="w-fit m-auto">
		<Card.Header class="space-y-1">
			<Card.Title class="text-2xl">Passwort wieder herstellen</Card.Title>
			<Card.Description>
					Geben Sie das Einmalpasswort ein:
			</Card.Description>
		</Card.Header>
			<Card.Content class="grid gap-4">
				<div class="grid gap-2">
					<Label for="password">Einmalpasswort</Label>
					<Input id="password" name="password" type="string" />
				</div>
			</Card.Content>
			<Card.Footer>
				<Button type="submit" class="w-full">Eingabe</Button>
			</Card.Footer>
	</Card.Root>
</div>