<script lang="ts">
	const { data } = $props();
	import { Toaster } from 'svelte-sonner';	
	import CompletedTours from '../../CompletedTours.svelte';
	const tours = data.tours;
</script>

<Toaster />

<div class="w-full h-full">
	<CompletedTours { tours }/>
</div>

