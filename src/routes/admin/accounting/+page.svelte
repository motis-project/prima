<script lang="ts">
	import AccountingView from '$lib/ui/AccountingView.svelte';

	const { data } = $props();
</script>

<AccountingView
	isAdmin={true}
	tours={data.tours}
	earliestTime={data.earliestTime}
	latestTime={data.latestTime}
	costPerDayAndVehicle={data.costPerDayAndVehicle}
/>
