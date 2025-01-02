<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
</script>

<div class="flex min-h-screen">
	<div class="container min-w-[1440px] relative mt-28">
		<section>
			<div class="overflow-hidden rounded-[0.5rem] border bg-background shadow-xl">
			<Card.Header class="space-y-1">
				<Card.Title class="text-2xl">Einmalpasswort gesendet!</Card.Title>
			</Card.Header>
			<Card.Content class="w-full h-full flex">
				<div>
					<p class="text-justify">
						Wir haben Ihnen eine E-Mail Adresse mit einem Einmalpasswort geschickt. 
						Bitte folgen Sie den Anweisungen in der E-Mail, um mithilfe des Einmalpasswort
						ihr Passwort zurückzusetzen. 
						Sollten Sie keine E-Mail erhalten haben klicken sie auf den Button "erneut senden".
					</p>
				</div>
				<Card.Footer>
					<div class="flex items-center justify-center">
						<Button data-sveltekit-preload-data="off" href="/forgotPassword">Erneut Senden</Button>
					</div>
				</Card.Footer>
			</Card.Content>
			</div>
		</section>
	</div>
</div>
