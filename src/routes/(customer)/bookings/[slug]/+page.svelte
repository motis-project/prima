<script lang="ts">
	import { goto } from '$app/navigation';
	import ConnectionDetail from '../../routing/ConnectionDetail.svelte';

	const { data } = $props();

	console.log(data);
</script>

<ConnectionDetail
	itinerary={data.journey}
	onClickStop={(_name: string, stopId: string, time: Date) =>
		goto(`/routing?stopId=${stopId}&time=${time.getTime()}`)}
	onClickTrip={(tripId: string) => goto(`/routing?tripId=${tripId}`)}
/>
