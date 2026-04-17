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

	let {
		minValue,
		selectedDays = $bindable(),
		range = $bindable()
	}: {
		minValue: CalendarDate;
		selectedDays: boolean[];
		range: {
			start: CalendarDate;
			end: CalendarDate;
		};
	} = $props();

	let repetitionLabel: undefined | string = $state(undefined);
	let timeRangeString = $derived(
		' ' + range.start?.toString() + ' ' + t.ride.to + range.end?.toString()
	);

	let intermediateRange = $state({ start: range.start, end: range.end });
	$effect(() => {
		if (intermediateRange.start && intermediateRange.start !== range.start) {
			range.start = intermediateRange.start;
		}
		if (intermediateRange.end && intermediateRange.end !== range.end) {
			range.end = intermediateRange.end;
		}
	});

	function updateDescription() {
		if (selectedDays.length === 0) {
			repetitionLabel = undefined;
			return;
		}
		if (!selectedDays.some((d) => !d)) {
			repetitionLabel = t.daily + timeRangeString;
			return;
		}
		repetitionLabel = selectedDays
			.map((d, i) => (d ? t.ride.daysList[i].full : undefined))
			.filter((d) => d !== undefined)
			.join(', ')
			.concat(timeRangeString);
	}

	function toggleDay(day: string) {
		const idx = t.ride.daysList.findIndex((d) => d.full === day);
		selectedDays[idx] = !selectedDays[idx];
	}

	function isDaySelected(day: string) {
		return selectedDays[t.ride.daysList.findIndex((d) => d.full === day)];
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
							aria-pressed={isDaySelected(day.full)}
							aria-label={day.full}
							onclick={() => toggleDay(day.full)}
							class={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-medium transition-colors
					${
						isDaySelected(day.full)
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
					<RangeCalendar
						{minValue}
						bind:value={intermediateRange}
						class="rounded-md border"
						locale={LOCALE}
					/>
				</Popover.Content>
			</Popover.Root>
			<Button
				onclick={() => {
					updateDescription();
					open = false;
				}}>{t.ride.addRule}</Button
			>
		</Popover.Content>
	</Popover.Root>
</div>
