<script lang="ts">
	import { RangeCalendar as RangeCalendarPrimitive } from "bits-ui";
	import * as RangeCalendar from "./index.js";
	import { cn } from "$lib/shadcn/utils.js";
	import {
    	DateFormatter,
    	getLocalTimeZone,
		today
  	} from "@internationalized/date";
	  import * as Select from "$lib/shadcn/select/index.js";

	type $$Props = RangeCalendarPrimitive.Props;
	//type $$Events = RangeCalendarPrimitive.Events; 

	export let value: $$Props["value"] = undefined;
	export let placeholder: $$Props["placeholder"] = today(getLocalTimeZone());
	export let weekdayFormat: $$Props["weekdayFormat"] = "short";
	export let startValue: $$Props["startValue"] = undefined;


	const monthOptions = [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember"
   	].map((month, i) => ({ value: i + 1, label: month }));
 
  	const monthFmt = new DateFormatter("en-US", {
    	month: "long"
  	});
 
  	const yearOptions = Array.from({ length: 25 }, (_, i) => ({
    	label: String(new Date().getFullYear() - i),
    	value: new Date().getFullYear() - i
  	}));
 
  	$: defaultYear = placeholder
    	? {
        	value: placeholder.year,
        	label: String(placeholder.year)
      	}
    	: undefined;
 
  	$: defaultMonth = placeholder
    	? {
        	value: placeholder.month,
        	label: monthFmt.format(placeholder.toDate(getLocalTimeZone()))
      	}
    	: undefined;

	let className: $$Props["class"] = undefined;
	export { className as class };
</script>

<RangeCalendarPrimitive.Root
	bind:value
	bind:placeholder
	bind:startValue
	{weekdayFormat}
	class={cn("p-3", className)}
	{...$$restProps}
	on:keydown
	let:months
	let:weekdays
>
	<!--<RangeCalendar.Header>
		<RangeCalendar.PrevButton />
		<RangeCalendar.Heading />
		<RangeCalendar.NextButton />
	</RangeCalendar.Header>-->
	<RangeCalendar.Header>
		<RangeCalendar.Heading class="flex w-full items-center justify-between gap-2">
			<Select.Root
			  selected={defaultMonth}
			  items={monthOptions}
			  onSelectedChange={(v) => {
				if (!v || !placeholder) return;
				if (v.value === placeholder?.month) return;
				placeholder = placeholder.set({ month: v.value });
			  }}
			>
			  <Select.Trigger aria-label="Select month" class="w-[60%]">
				<Select.Value placeholder="Select month" />
			  </Select.Trigger>
			  <Select.Content class="max-h-[200px] overflow-y-auto">
				{#each monthOptions as { value, label }}
				  <Select.Item {value} {label}>
					{label}
				  </Select.Item>
				{/each}
			  </Select.Content>
			</Select.Root>
			<Select.Root
			  selected={defaultYear}
			  items={yearOptions}
			  onSelectedChange={(v) => {
				if (!v || !placeholder) return;
				if (v.value === placeholder?.year) return;
				placeholder = placeholder.set({ year: v.value });
			  }}
			>
			  <Select.Trigger aria-label="Select year" class="w-[40%]">
				<Select.Value placeholder="Select year" />
			  </Select.Trigger>
			  <Select.Content class="max-h-[200px] overflow-y-auto">
				{#each yearOptions as { value, label }}
				  <Select.Item {value} {label}>
					{label}
				  </Select.Item>
				{/each}
			  </Select.Content>
			</Select.Root>
		  </RangeCalendar.Heading>
	</RangeCalendar.Header>
	<RangeCalendar.Months>
		{#each months as month}
			<RangeCalendar.Grid>
				<RangeCalendar.GridHead>
					<RangeCalendar.GridRow class="flex">
						{#each weekdays as weekday}
							<RangeCalendar.HeadCell>
								{weekday.slice(0, 2)}
							</RangeCalendar.HeadCell>
						{/each}
					</RangeCalendar.GridRow>
				</RangeCalendar.GridHead>
				<RangeCalendar.GridBody>
					{#each month.weeks as weekDates}
						<RangeCalendar.GridRow class="mt-2 w-full">
							{#each weekDates as date}
								<RangeCalendar.Cell {date}>
									<RangeCalendar.Day {date} month={month.value} />
								</RangeCalendar.Cell>
							{/each}
						</RangeCalendar.GridRow>
					{/each}
				</RangeCalendar.GridBody>
			</RangeCalendar.Grid>
		{/each}
	</RangeCalendar.Months>
</RangeCalendarPrimitive.Root>
