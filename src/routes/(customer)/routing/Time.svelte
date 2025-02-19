<script lang="ts">
	import { formatTime } from './toDateTime';
	import { cn } from './utils';

	let {
		class: className,
		timestamp,
		scheduledTimestamp,
		isRealtime,
		variant,
		queriedTime
	}: {
		class?: string;
		timestamp: string;
		scheduledTimestamp: string;
		isRealtime: boolean;
		variant: 'schedule' | 'realtime' | 'realtime-show-always';
		queriedTime: string | undefined;
	} = $props();

	const t = $derived(new Date(timestamp));
	const scheduled = $derived(new Date(scheduledTimestamp));
	const delayMinutes = $derived((t.getTime() - scheduled.getTime()) / 60000);
	const highDelay = $derived(isRealtime && delayMinutes > 3);
	const lowDelay = $derived(isRealtime && delayMinutes <= 3);

	function weekday(time: Date) {
		if (queriedTime === undefined) {
			return '';
		}

		const base = new Date(queriedTime);

		if (base.toLocaleDateString() === time.toLocaleDateString()) {
			return '';
		}

		const weekday = time.toLocaleString(navigator.language, { weekday: 'long' });

		return `(${weekday})`;
	}
</script>

<div class={cn('w-16', className)}>
	{#if variant == 'schedule'}
		{formatTime(scheduled)}
		{weekday(scheduled)}
	{:else if variant === 'realtime-show-always' || (variant === 'realtime' && isRealtime)}
		<span class:text-destructive={highDelay} class:text-green-600={lowDelay}>
			{formatTime(t)}
		</span>
		{weekday(t)}
	{/if}
</div>
