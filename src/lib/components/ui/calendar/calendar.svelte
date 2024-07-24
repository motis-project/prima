<script lang="ts">
	import { Calendar as CalendarPrimitive } from 'bits-ui';
	import {
		Day,
		Cell,
		Grid,
		Header,
		Months,
		GridRow,
		Heading,
		GridBody,
		GridHead,
		HeadCell,
		NextButton,
		PrevButton
	} from './index.js';
	import { cn } from '$lib/utils.js';

	type $$Props = CalendarPrimitive.Props;

	export let value: $$Props['value'] = undefined;
	export let placeholder: $$Props['placeholder'] = undefined;
	export let weekdayFormat: $$Props['weekdayFormat'] = 'short';

	let className: $$Props['class'] = undefined;
	export { className as class };
</script>

<CalendarPrimitive.Root
	bind:value
	bind:placeholder
	{weekdayFormat}
	class={cn('p-3', className)}
	{...$$restProps}
	on:keydown
	let:months
	let:weekdays
>
	<Header>
		<PrevButton />
		<Heading />
		<NextButton />
	</Header>
	<Months>
		{#each months as month}
			<Grid>
				<GridHead>
					<GridRow class="flex">
						{#each weekdays as weekday}
							<HeadCell>
								{weekday.slice(0, 2)}
							</HeadCell>
						{/each}
					</GridRow>
				</GridHead>
				<GridBody>
					{#each month.weeks as weekDates}
						<GridRow class="mt-2 w-full">
							{#each weekDates as date}
								<Cell {date}>
									<Day {date} month={month.value} />
								</Cell>
							{/each}
						</GridRow>
					{/each}
				</GridBody>
			</Grid>
		{/each}
	</Months>
</CalendarPrimitive.Root>
