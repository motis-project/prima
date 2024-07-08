<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Tour } from './Tour';
	import { Event } from './Event';

	class Props {
		open!: { open: boolean };
		selectedTour!: Tour | null;
		selectedTourEvents!: Array<Event> | null;
	}
	const { open = $bindable(), selectedTour, selectedTourEvents }: Props = $props();
</script>

<Dialog.Root
	open={open.open}
	onOpenChange={(x) => {
		if (!x) {
			open.open = false;
		}
	}}
>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Tour Details</Dialog.Title>
			<Dialog.Description>
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head class="w-[100px]">Tour ID</Table.Head>
							<Table.Head class="w-[100px]">Start</Table.Head>
							<Table.Head class="w-[100px]">Ende</Table.Head>
							<Table.Head class="text-right">Fahrzeug</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if selectedTour != null}
							<Table.Row>
								<Table.Cell class="font-medium">{selectedTour.id}</Table.Cell>
								<Table.Cell>{selectedTour.from.toLocaleString()}</Table.Cell>
								<Table.Cell>{selectedTour.to.toLocaleString()}</Table.Cell>
								<Table.Cell class="text-right">{selectedTour.vehicle_id}</Table.Cell>
							</Table.Row>
						{/if}
					</Table.Body>
				</Table.Root>
				{#each selectedTourEvents as event}
					<p>{event.street}</p>
					<p>{event.house_number}</p>
					<p>{event.postal_code}</p>
					<p>{event.city}</p>
				{/each}
			</Dialog.Description>
		</Dialog.Header>
	</Dialog.Content>
</Dialog.Root>
