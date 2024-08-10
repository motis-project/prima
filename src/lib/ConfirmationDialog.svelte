<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import type { TourDetails } from '$lib/TourDetails';
	import { reassignTour } from '$lib/api';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';

	let showFailed = $state<boolean>(false);

	class Props {
		tour: TourDetails | undefined;
	}
	let { tour = $bindable() }: Props = $props();

	const handleConfirm = async () => {
		showFailed = false;
		if (tour) {
			let ok = await reassignTour(tour.tour_id);
			if (ok) {
				tour = undefined;
			} else {
				showFailed = true;
			}
		}
	};
</script>

<AlertDialog.Root>
	<AlertDialog.Trigger
		><Button variant="destructive">Tour redisponieren</Button></AlertDialog.Trigger
	>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Sind Sie sicher?</AlertDialog.Title>
			<AlertDialog.Description>
				Diese Fahrt wid (falls möglich) einem anderen Anbieter zugewiesen.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Abbrechen</AlertDialog.Cancel>
			<AlertDialog.Action on:click={handleConfirm}>Ok</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root open={showFailed}>
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
