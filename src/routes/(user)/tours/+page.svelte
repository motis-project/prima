<script lang="ts">
	const { data } = $props();
	import { Toaster } from 'svelte-sonner';
	import CompletedTours from '../../CompletedTours.svelte';
	const tours = data.tours;
	const isMaintainer = false;
</script>

<Toaster />

<div class="w-full h-full">
	<CompletedTours {isMaintainer} {tours} />
</div>
