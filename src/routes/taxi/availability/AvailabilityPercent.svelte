<script lang="ts">
	import * as Popover from '$lib/shadcn/popover';
	import { buttonVariants } from '$lib/shadcn/button';
	import { t } from '$lib/i18n/translation';
	import { CircleSlash2 } from 'lucide-svelte';

	const {
		text,
		showIcon
	}: {
		text: string;
		showIcon?: boolean;
	} = $props();

	let popoverOpen = $state(false);
</script>

<Popover.Root bind:open={popoverOpen}>
	<Popover.Trigger
		class={buttonVariants({
			variant: 'outline',
			class: 'w-full justify-start text-left font-normal'
		})}
	>
		<span class="inline-flex items-center gap-1">
			{#if showIcon}
				<CircleSlash2 size={16} />
			{/if}
			{(showIcon ? t.availabilityPercentAverage : t.availabilityPercent) + ': ' + text}
		</span>
	</Popover.Trigger>

	<Popover.Content>
		<div class="flex flex-col gap-4">
			{showIcon ? t.availabilityPercentAverageExplanation : t.availabilityPercentExplanation}
		</div>
	</Popover.Content>
</Popover.Root>
