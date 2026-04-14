<script lang="ts">
	import * as Popover from '$lib/shadcn/popover';
	import { t } from '$lib/i18n/translation';
	import {
		MAX_AVAILABILITY_FOR_COMPENSATION,
		MIN_AVAILABILITY_FOR_COMPENSATION
	} from '$lib/constants';

	const {
		availabilityCoverage,
		class: className
	}: { availabilityCoverage: number; class: string } = $props();

	const percent = $derived.by(() => {
		if (availabilityCoverage < MIN_AVAILABILITY_FOR_COMPENSATION) {
			return 0;
		}
		if (availabilityCoverage > MAX_AVAILABILITY_FOR_COMPENSATION) {
			return 100;
		}
		return (
			(100 * (availabilityCoverage - MIN_AVAILABILITY_FOR_COMPENSATION)) /
			(MAX_AVAILABILITY_FOR_COMPENSATION - MIN_AVAILABILITY_FOR_COMPENSATION)
		);
	});

	let popoverOpen = $state(false);
</script>

<Popover.Root bind:open={popoverOpen}>
	<Popover.Trigger>
		<div
			class="{className} rounded-full border px-2 text-lg font-bold"
			style="background: hsl({percent} 100% 33%)"
		>
			{Math.round(availabilityCoverage * 100)}%
		</div>
	</Popover.Trigger>

	<Popover.Content>
		<div class="flex flex-col gap-4">
			{t.availabilityPercentExplanation}
		</div>
	</Popover.Content>
</Popover.Root>
