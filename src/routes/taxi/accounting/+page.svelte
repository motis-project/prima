<script lang="ts">
	import AccountingView from '$lib/ui/AccountingView.svelte';

	const { data } = $props();
</script>

<div class="w-[1440px]">
	<AccountingView
		isAdmin={false}
		tours={data.tours}
		earliestTime={data.earliestTime}
		latestTime={data.latestTime}
		costPerDayAndVehicle={data.costPerDayAndVehicle}
		selectedTourId={data.tourId}
	/>
</div>
