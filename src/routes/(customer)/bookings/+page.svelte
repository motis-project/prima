<script lang="ts">
	import Alert from 'lucide-svelte/icons/triangle-alert';
	import ItinerarySummary from '../routing/ItinerarySummary.svelte';
	import { t } from '$lib/i18n/translation';

	const { data } = $props();
</script>

{#snippet cancelled()}
	<Alert class="size-4" />
	{t.msg.cancelled}
{/snippet}

<div class="flex flex-col gap-4">
	{#each data.journeys as it}
		<a href="/bookings/{it.id}">
			<ItinerarySummary it={it.journey} info={it.cancelled ? cancelled : undefined} />
		</a>
	{/each}
</div>
