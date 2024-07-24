<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
</script>

<div class="flex min-h-screen">
	<div class="container min-w-[1440px] relative mt-28">
		<section>
			<div class="overflow-hidden rounded-[0.5rem] border bg-background shadow-xl">
				<Card.Header>
					<Card.Title>Willkommen beim Projekt PrimaÖV!</Card.Title>
				</Card.Header>
				<Card.Content class="w-full h-full flex">
					<div>
						<p class="text-justify">
							Sie sind auf dieser Seite gelandet, da Ihr neu angelegter Account noch nicht
							freigeschaltet wurde. Falls Sie als Taxiunternehmer an dem Projekt teilnehmen möchten,
							warten Sie bitte bis Sie mitgeteilt bekommen, dass Ihr Account freigeschaltet wurde.
							Sollte dies bereits geschehen sein, können Sie die Seite neu laden.
						</p>
					</div>
					<div class="w-8">
						<Separator orientation="vertical" class="mx-4" />
					</div>
					<div class="flex h-full w-full items-center justify-center">
						<Button data-sveltekit-preload-data="off" href="/logout">Logout</Button>
					</div>
				</Card.Content>
			</div>
		</section>
	</div>
</div>
