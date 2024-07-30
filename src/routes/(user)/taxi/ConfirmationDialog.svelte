<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import type { TourDetails } from './TourDetails';
	import { reassignTour } from '$lib/api';

	let open = $state<boolean>(false);

	class Props {
		tour: TourDetails | undefined;
	}
	let { tour = $bindable() }: Props = $props();

	const handleConfirm = async () => {
		if (tour) {
			await reassignTour(tour.tour_id);
		}
		tour = undefined;
	};

	const handleCancel = () => {
		open = false;
	};
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger><Button variant="destructive">Tour redisponieren</Button></Dialog.Trigger>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Sind Sie sicher?</Dialog.Title>
			<Dialog.Description>
				Dies kann nicht rückgangig gemacht werden.<br />
				Die Fahrt wid (falls möglich) einem anderen Anbieter zugewiesen.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Description>
			<Button on:click={handleConfirm}>Ok</Button>
			<Button on:click={handleCancel}>Abbrechen</Button>
		</Dialog.Description>
	</Dialog.Content>
</Dialog.Root>
