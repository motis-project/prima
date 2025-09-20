<script lang="ts">
	import { formatTime } from '$lib/util/formatTime';
	import { getScheduledEventTime } from '$lib/util/getScheduledEventTime';
	import type { TourEvent } from '$lib/util/getToursTypes';
	import EmailFooter from './EmailFooter.svelte';

	const {
		name,
		events,
		departure
	}: {
		name: string;
		events: TourEvent[];
		departure: number;
	} = $props();

	events.sort(
		(e1: TourEvent, e2: TourEvent) => getScheduledEventTime(e1) - getScheduledEventTime(e2)
	);
	console.log('sending cancelation notice mail to company: ', { name }, { events }, { departure });
	const plannedEvents = events.filter((e) => !e.cancelled);
</script>

<div>
	Guten Tag {name},
	<p>Es gab Stornierungen in der Fahrt</p>
	<ul>
		<li>von {events[0].address}</li>
		<li>nach {events[events.length - 1].address}</li>
	</ul>
	<p>
		die von {formatTime(getScheduledEventTime(events[0]))}
		bis {formatTime(getScheduledEventTime(events[events.length - 1]))}
		stattfinden sollte.
	</p>
	{#if plannedEvents.length > 1}
		<p>Die folgenden Halte sind immer noch eingeplant:</p>
		<ul>
			{#each plannedEvents as e}
				<li>{formatTime(getScheduledEventTime(e))}, {e.address}</li>
			{/each}
		</ul>
	{/if}
	<p>Die stornierten Buchungen werden weiterhin angezeigt, sind nun aber als storniert markiert.</p>
	{#if plannedEvents.length < 2}
		<p>
			Die Fahrt wurde vollständig storniert. Sie finden diese immer noch unter Abrechnung, sie ist
			nun als storniert markiert.
		</p>
	{/if}
	<EmailFooter />
</div>
