<script lang="ts">
	import ToursTable from '$lib/ui/ToursTable.svelte';

	const { data } = $props();
</script>

<ToursTable isAdmin={false} tours={data.tours} selectedTourId={data.tourId} />
