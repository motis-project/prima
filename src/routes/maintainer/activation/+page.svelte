<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import type { ActionData } from './$types';

	export let form: ActionData;

	console.log('Hello from maintainer page');
</script>

<div class="w-full h-full">
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
