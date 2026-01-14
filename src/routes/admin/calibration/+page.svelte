<script lang="ts">
	import { enhance } from '$app/forms';
	import { Input } from '$lib/shadcn/input';
	import Label from '$lib/shadcn/label/label.svelte';
	import { t } from '$lib/i18n/translation';
	import { Button } from '$lib/shadcn/button';
	import Save from 'lucide-svelte/icons/save';
	import ListPlus from 'lucide-svelte/icons/list-plus';
	import { goto } from '$app/navigation';
	import CalibrationSetView from './CalibrationSetView.svelte';

	const { data } = $props();
	let perTransfer = $state(data.filterSettings?.perTransfer);
	let taxiBase = $state(data.filterSettings?.taxiBase);
	let taxiPerMinute = $state(data.filterSettings?.taxiPerMinute);
	let taxiDirectPenalty = $state(data.filterSettings?.taxiDirectPenalty);
	let ptSlope = $state(data.filterSettings?.ptSlope);
	let taxiSlope = $state(data.filterSettings?.taxiSlope);
</script>

<div class="flex flex-col gap-4">
	<p class="ml-4">{t.calibration.greeter}</p>
	<form
		method="post"
		autocomplete="off"
		class="flex flex-row gap-4 rounded-md border-2 border-solid p-2"
		use:enhance={() => {
			return async ({ update }) => {
				update({ reset: false });
			};
		}}
	>
		<Label for="perTransfer">{t.calibration.perTransfer}</Label>
		<Input name="perTransfer" type="string" bind:value={perTransfer} />
		<Label for="taxiBase">{t.calibration.taxiBase}</Label>
		<Input name="taxiBase" type="string" bind:value={taxiBase} />
		<Label for="taxiPerMinute">{t.calibration.taxiPerMinute}</Label>
		<Input name="taxiPerMinute" type="string" bind:value={taxiPerMinute} />
		<Label for="taxiDirectPenalty">{t.calibration.taxiDirectPenalty}</Label>
		<Input name="taxiDirectPenalty" type="string" bind:value={taxiDirectPenalty} />
		<Label for="ptSlope">{t.calibration.ptSlope}</Label>
		<Input name="ptSlope" type="string" bind:value={ptSlope} />
		<Label for="taxiSlope">{t.calibration.taxiSlope}</Label>
		<Input name="taxiSlope" type="string" bind:value={taxiSlope} />

		<Button type="submit" data-testid="submit-filter-setting">
			<Save />
		</Button>
	</form>

	{#each data.calibrationSets as c}
		<CalibrationSetView id={c.id} name={c.name} itineraries={c.itineraries} />
		{c.itineraries}
	{/each}

	<Button variant="default" size="default" onclick={() => goto('/routing')}>
		<ListPlus />
		{t.calibration.addCalibrationSet}
	</Button>
</div>
