<script lang="ts">
	const { data } = $props();
	import * as Card from '$lib/components/ui/card';
	import { Toaster } from 'svelte-sonner';
	import * as Table from '$lib/components/ui/table/index.js';

	console.log(data.tours);
</script>

<Toaster />

<div class="w-full h-full">
	<Card.Header>
		<Card.Title>Abgeschlossene Fahrten</Card.Title>
	</Card.Header>
	<Card.Content class="w-full h-full">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Abfahrt</Table.Head>
					<Table.Head>Straße</Table.Head>
					<Table.Head>Hausnr.</Table.Head>
					<Table.Head>Ort</Table.Head>
					<Table.Head>Kunde</Table.Head>
					<Table.Head>Tel. Kunde</Table.Head>
					<Table.Head>Ein-/Ausstieg</Table.Head>
					<Table.Head class="text-right">Fahrpreis</Table.Head>
				</Table.Row>
			</Table.Header>

			<Table.Body></Table.Body>
		</Table.Root>
	</Card.Content>
</div>
