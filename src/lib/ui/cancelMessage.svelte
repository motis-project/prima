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

	export let tourId: number | undefined;
	let open = false;
	let reason = '';

	function handleCancel() {
		open = false;
	}

	async function handleConfirm() {
		if (tourId != undefined && reason != '') {
			await cancelTour(tourId, reason);
		}
		open = false;
	}
</script>

<Dialog {open} onOpenChange={(e) => (open = e)}>
	<DialogTrigger>
		<Button variant="destructive" onclick={() => (open = true)}>Stornieren</Button>
	</DialogTrigger>

	<DialogContent>
		<DialogHeader>
			<DialogTitle>Tour stornieren</DialogTitle>
		</DialogHeader>

		<Input type="text" bind:value={reason} placeholder="Geben Sie den Stornierungsgrund ein..." />

		<DialogFooter>
			<Button variant="outline" onclick={handleCancel}>Abbrechen</Button>
			<Button variant="default" onclick={handleConfirm}>OK</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
