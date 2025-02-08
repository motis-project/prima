<script lang="ts">
	import ArrowUpDown from 'lucide-svelte/icons/arrow-up-down';
	import Accessibility from 'lucide-svelte/icons/accessibility';
	import Bike from 'lucide-svelte/icons/bike';
	import AddressTypeahead from '$lib/ui/AddressTypeahead.svelte';
	import Button from '$lib/shadcn/button/button.svelte';
	import { Label } from '$lib/shadcn/label';
	import * as RadioGroup from '$lib/shadcn/radio-group';
	import DateInput from './DateInput.svelte';
	import { type Location } from '$lib/map/Location';
	import { Toggle } from '$lib/shadcn/toggle';
	import { t } from '$lib/i18n/translation';

	let {
		from = $bindable(),
		to = $bindable(),
		time = $bindable(),
		timeType = $bindable(),
		wheelchair = $bindable(),
		bikeRental = $bindable()
	}: {
		from: Location;
		to: Location;
		time: Date;
		timeType: string;
		wheelchair: boolean;
		bikeRental: boolean;
	} = $props();

	let fromItems = $state<Array<Location>>([]);
	let toItems = $state<Array<Location>>([]);
</script>

<div id="searchmask-container" class="relative flex flex-col space-y-4 p-4">
	<AddressTypeahead name="from" placeholder={t.from} bind:selected={from} bind:items={fromItems} />
	<AddressTypeahead name="to" placeholder={t.to} bind:selected={to} bind:items={toItems} />
	<Button
		class="absolute right-12 top-6 z-10"
		variant="outline"
		size="icon"
		onclick={() => {
			const tmp = to;
			to = from;
			from = tmp;

			const tmpItems = toItems;
			toItems = fromItems;
			fromItems = tmpItems;
		}}
	>
		<ArrowUpDown class="h-5 w-5" />
	</Button>
	<div class="flex flex-row flex-wrap gap-2">
		<DateInput bind:value={time} />
		<RadioGroup.Root class="flex" bind:value={timeType}>
			<Label
				for="departure"
				class="flex items-center rounded-md border-2 border-muted bg-popover p-1 px-2 hover:cursor-pointer hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-blue-600"
			>
				<RadioGroup.Item value="departure" id="departure" class="sr-only" aria-label="Abfahrt" />
				<span>{t.departure}</span>
			</Label>
			<Label
				for="arrival"
				class="flex items-center rounded-md border-2 border-muted bg-popover p-1 px-2 hover:cursor-pointer hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-blue-600"
			>
				<RadioGroup.Item value="arrival" id="arrival" class="sr-only" aria-label="Ankunft" />
				<span>{t.arrival}</span>
			</Label>
		</RadioGroup.Root>
		<div>
			<Toggle aria-label="toggle bold" bind:pressed={wheelchair}>
				<Accessibility class="h-6 w-6" />
			</Toggle>
			<Toggle aria-label="toggle bold" bind:pressed={bikeRental}>
				<Bike class="h-6 w-6" />
			</Toggle>
		</div>
	</div>
</div>
