<script lang="ts">
	import { t } from '$lib/i18n/translation';
	import type { CalendarDate } from '@internationalized/date';
	import * as Popover from '$lib/shadcn/popover';
	import { Button } from '$lib/shadcn/button';
	import { cn } from '$lib/shadcn/utils';
	import { RangeCalendar } from '$lib/shadcn/range-calendar/index.js';
	import { CalendarIcon } from 'lucide-svelte';
	import { Label } from '$lib/shadcn/label';
	import { LOCALE, TZ } from '$lib/constants';

	let {
		minValue,
		selectedDays = $bindable(),
		range = $bindable(),
		active = true,
		framed = true
	}: {
		minValue: CalendarDate;
		selectedDays: boolean[];
		range: {
			start: CalendarDate;
			end: CalendarDate;
		};
		active?: boolean;
		framed?: boolean;
	} = $props();

	function formatCalendarDate(date: CalendarDate | undefined) {
		return date?.toDate(TZ).toLocaleDateString(LOCALE) ?? '';
	}

	let timeRangeString = $derived(
		' ' + formatCalendarDate(range.start) + ' ' + t.ride.to + formatCalendarDate(range.end)
	);

	let repetitionLabel = $derived.by(() => {
		if (!selectedDays.some(Boolean)) {
			return timeRangeString.trim();
		}
		if (!selectedDays.some((d) => !d)) {
			return t.daily + timeRangeString;
		}
		return selectedDays
			.map((d, i) => (d ? t.ride.daysList[i].full : undefined))
			.filter((d) => d !== undefined)
			.join(', ')
			.concat(timeRangeString);
	});

	let intermediateRange = $state({ start: range.start, end: range.end });
	$effect(() => {
		if (intermediateRange.start && intermediateRange.start !== range.start) {
			range.start = intermediateRange.start;
		}
		if (intermediateRange.end && intermediateRange.end !== range.end) {
			range.end = intermediateRange.end;
		}
	});

	function toggleDay(day: string) {
		if (!active) {
			return;
		}
		const idx = t.ride.daysList.findIndex((d) => d.full === day);
		selectedDays[idx] = !selectedDays[idx];
	}

	function isDaySelected(day: string) {
		return selectedDays[t.ride.daysList.findIndex((d) => d.full === day)];
	}
</script>

<div
	class={cn(
		'flex flex-col gap-4 transition-opacity',
		framed && 'rounded-lg border border-input p-4',
		!active && 'opacity-60'
	)}
>
	<div class="text-sm text-muted-foreground">{repetitionLabel}</div>

	<fieldset class="flex flex-col gap-2" disabled={!active}>
		<legend class="text-sm font-medium">{t.ride.individualDays}</legend>

		<div class="flex items-center gap-2">
			{#each t.ride.daysList as day}
				<button
					type="button"
					aria-pressed={isDaySelected(day.full)}
					aria-label={day.full}
					disabled={!active}
					onclick={() => toggleDay(day.full)}
					class={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-medium transition-colors disabled:cursor-not-allowed
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

	<div class="flex flex-col gap-2">
		<Label>{t.ride.chooseTimeSpan}</Label>
		<Popover.Root>
			<Popover.Trigger disabled={!active}>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="outline"
						class="w-fit justify-start"
						disabled={!active}
						type="button"
					>
						<CalendarIcon class="mr-2 size-4" />
						{timeRangeString}
					</Button>
				{/snippet}
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
	</div>
</div>
