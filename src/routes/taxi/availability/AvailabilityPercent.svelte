<script lang="ts">
	import * as Popover from '$lib/shadcn/popover';
	import { buttonVariants } from '$lib/shadcn/button';
	import { t } from '$lib/i18n/translation';

	const {
		text
	}: {
		text: string;
	} = $props();

	let popoverOpen = $state(false);
</script>

<Popover.Root bind:open={popoverOpen}>
	<Popover.Trigger
		class={buttonVariants({
			variant: 'outline',
			class: 'w-fit justify-start text-left font-normal'
		})}
	>
		{t.availabilityPercent + ': ' + text}
	</Popover.Trigger>
	<Popover.Content>
		<div class="flex flex-col gap-4">
			<h2 class="font-medium leading-none">
				{t.availabilityPercentExplanation}
			</h2>
		</div>
	</Popover.Content>
</Popover.Root>
