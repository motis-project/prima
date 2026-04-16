<script lang="ts">
	import { t } from '$lib/i18n/translation';
	import type { CalendarDate } from '@internationalized/date';
	import * as Popover from '$lib/shadcn/popover';
	import { Button, buttonVariants } from '$lib/shadcn/button';
	import { cn } from '$lib/shadcn/utils';
	import { RangeCalendar } from '$lib/shadcn/range-calendar/index.js';
	import { CalendarIcon } from 'lucide-svelte';
	import { Label } from '$lib/shadcn/label';
	import { LOCALE } from '$lib/constants';

	export type Day = 0 | 1 | 2 | 3 | 4 | 5 | 6;

	let {
		selectedDays = $bindable(),
		range = $bindable(),
		addDaysByRule
	}: {
		selectedDays: Day[];
		range: {
			start: CalendarDate;
			end: CalendarDate;
		};
		addDaysByRule: () => void;
	} = $props();

	let repetitionLabel: undefined | string = $state(undefined);
	let timeRangeString = $derived(
		' ' + range.start?.toString() + ' ' + t.ride.to + range.end?.toString()
	);

	function updateDescription() {
		console.log({ selectedDays: selectedDays.length });
		if (selectedDays.length === 0) {
			repetitionLabel = undefined;
			return;
		}
		if (selectedDays.length === 7) {
			repetitionLabel = 'daily' + timeRangeString;
			return;
		}
		repetitionLabel = selectedDays
			.map((d) => t.ride.daysList.find((day) => day.key === d)!.full)
			.join(', ')
			.concat(timeRangeString);
	}

	function toggleDay(day: Day) {
		selectedDays = selectedDays.includes(day)
			? (selectedDays.filter((d) => d !== day) as Day[])
			: ([...selectedDays, day].sort((a, b) => a - b) as Day[]);
	}

	let open = $state(false);
</script>

<div class="flex gap-2">
	<Popover.Root bind:open>
		<Popover.Trigger class={cn(buttonVariants({ variant: 'default' }), 'grow')}>
			{repetitionLabel ?? t.ride.repetitionLabel}
		</Popover.Trigger>
		<Popover.Content class="flex w-fit flex-col gap-4">
			<fieldset class="flex flex-col gap-2">
				<legend class="text-sm font-medium"> Repeat on </legend>

				<div class="flex items-center gap-2">
					{#each t.ride.daysList as day}
						<button
							type="button"
							aria-pressed={selectedDays.includes(day.key)}
							aria-label={day.full}
							onclick={() => toggleDay(day.key)}
							class={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-medium transition-colors
					${
						selectedDays.includes(day.key)
							? 'border-blue-600 bg-blue-600 text-white'
							: 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100'
					}`}
						>
							{day.short}
						</button>
					{/each}
				</div>
			</fieldset>
			<Label>{t.ride.chooseTimeSpan}</Label>
			<Popover.Root>
				<Popover.Trigger class={cn(buttonVariants({ variant: 'outline' }), 'w-fit justify-start')}>
					<CalendarIcon class="mr-2 size-4" />
					{timeRangeString}
				</Popover.Trigger>
				<Popover.Content class="w-auto p-2">
					<RangeCalendar bind:value={range} class="rounded-md border" locale={LOCALE} />
				</Popover.Content>
			</Popover.Root>
			<Button
				onclick={() => {
					addDaysByRule();
					updateDescription();
					open = false;
				}}>{t.ride.addRule}</Button
			>
		</Popover.Content>
	</Popover.Root>
</div>
