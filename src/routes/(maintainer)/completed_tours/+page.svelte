<script lang="ts">
	const { data } = $props();
	import CompletedTours from '$lib/CompletedTours.svelte';
</script>

<div class="w-full h-full">
	<CompletedTours isMaintainer={true} tours={data.tours} />
</div>
