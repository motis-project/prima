<script lang="ts">
	import {
		Dialog,
		DialogTrigger,
		DialogContent,
		DialogHeader,
		DialogFooter,
		DialogTitle
	} from '$lib/shadcn/dialog';
	import { Button } from '$lib/shadcn/button';
	import { Input } from '$lib/shadcn/input';
	import { cancelTour } from '$lib/cancelTour';
	import { invalidateAll } from '$app/navigation';

	let { tour = $bindable() } = $props();
	let isDialogOpen = $state(false);
	let reason = $state('');
	let errorMessage: string | undefined = $state(undefined);

	function handleCancel() {
		isDialogOpen = false;
	}

	async function handleConfirm() {
		errorMessage = undefined;
		if (reason == '') {
			errorMessage = 'Stornieren erfordert die Angabe des Grundes.';
			return;
		}
		if (tour != undefined) {
			await cancelTour(tour.tourId, reason);
			tour = undefined;
			await invalidateAll();
		}
	}
</script>

<Dialog bind:open={isDialogOpen} onOpenChange={(e) => (isDialogOpen = e)}>
	<DialogTrigger>
		<Button variant="destructive" onclick={() => (isDialogOpen = true)}>Stornieren</Button>
	</DialogTrigger>

	<DialogContent>
		<DialogHeader>
			<DialogTitle>Tour stornieren</DialogTitle>
		</DialogHeader>
		<div class="mb-2 text-gray-500">Bitte geben Sie den Stornierungsgrund an.</div>
		<Input type="text" bind:value={reason} />
		{#if errorMessage != undefined}
			<div class="text-red-500">{errorMessage}</div>
		{/if}

		<DialogFooter>
			<Button variant="default" onclick={handleConfirm}>Stornieren bestätigen</Button>
			<Button variant="outline" onclick={handleCancel}>Stornieren abbrechen</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
