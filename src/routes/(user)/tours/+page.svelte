<script lang="ts">
	const { data } = $props();
	import CompletedTours from '../../CompletedTours.svelte';
</script>

<div class="w-full h-full">
	<CompletedTours isMaintainer={false} tours={data.tours} />
</div>
