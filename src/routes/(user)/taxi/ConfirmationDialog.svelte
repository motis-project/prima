<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import type { TourDetails } from './TourDetails';
	import { reassignTour } from '$lib/api';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';

	let open = $state<boolean>(false);
	let failed = $state<boolean>(false);

	class Props {
		tour: TourDetails | undefined;
	}
	let { tour = $bindable() }: Props = $props();

	const handleConfirm = async () => {
		if (tour) {
			let ok = await reassignTour(tour.tour_id);
			if (ok) {
				tour = undefined;
			} else {
				failed = true;
				open = false;
			}
		}
	};
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Trigger
		><Button variant="destructive" disabled={failed}>Tour redisponieren</Button
		></AlertDialog.Trigger
	>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Sind Sie sicher?</AlertDialog.Title>
			<AlertDialog.Description>
				Diese Fahrt wid (falls möglich) einem anderen Anbieter zugewiesen.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel
				on:click={() => {
					open = false;
				}}>Abbrechen</AlertDialog.Cancel
			>
			<AlertDialog.Action on:click={handleConfirm}>Weiter</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root open={failed}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Die Tour konnte nicht redisponiert werden</AlertDialog.Title>
			<AlertDialog.Description>Bitte informieren Sie den Kunden.</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Action>Ok</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
