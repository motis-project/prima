<script>
	import ConnectionDetail from '../../routing/ConnectionDetail.svelte';

	const { data } = $props();
</script>

<ConnectionDetail itinerary={data.journey} onClickStop={() => {}} onClickTrip={() => {}} />
