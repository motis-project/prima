<script lang="ts">
	import AccountingView from '$lib/ui/AccountingView.svelte';

	const { data } = $props();
</script>

<AccountingView
	isAdmin={false}
	tours={data.tours}
	companyCostsPerDay={data.companyCostsPerDay}
	earliestTime={data.earliestTime}
/>
