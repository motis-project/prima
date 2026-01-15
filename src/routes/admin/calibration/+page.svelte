<script lang="ts">
	import { enhance } from '$app/forms';
	import { Input } from '$lib/shadcn/input';
	import Label from '$lib/shadcn/label/label.svelte';
	import { t } from '$lib/i18n/translation';
	import { Button } from '$lib/shadcn/button';
	import Save from 'lucide-svelte/icons/save';
	import ListPlus from 'lucide-svelte/icons/list-plus';
	import Trash from 'lucide-svelte/icons/trash';
	import { goto } from '$app/navigation';
	import ItinerarySummary from '../../(customer)/routing/ItinerarySummary.svelte';
	import type { CalibrationItinerary } from '$lib/calibration';

	const { data } = $props();
	let perTransfer = $state(data.filterSettings?.perTransfer);
	let taxiBase = $state(data.filterSettings?.taxiBase);
	let taxiPerMinute = $state(data.filterSettings?.taxiPerMinute);
	let taxiDirectPenalty = $state(data.filterSettings?.taxiDirectPenalty);
	let ptSlope = $state(data.filterSettings?.ptSlope);
	let taxiSlope = $state(data.filterSettings?.taxiSlope);
	let calibrationSets = $state(data.calibrationSets);
</script>

<div class="flex flex-col gap-4">
	<p class="ml-4">{t.calibration.greeter}</p>
	<form
		method="post"
		action="?/applyParams"
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

	{#each calibrationSets as c, cI}
		<div class="flex h-[1000px] rounded-lg border-2 border-solid">
			<div class="flex flex-col gap-2 p-1">
				id: {c.id}, name: {c.name}, #itineraries: {c.itineraries.length}
				<div class="overflow-auto rounded-lg border-2 border-solid">
					{#each c.itineraries as it, itI}
						<div class="flex flex-col p-1">
							<ItinerarySummary {it} />
							<div
								class="flex items-center justify-end gap-2 rounded-lg border-x-2 border-b-2 px-2 text-sm"
							>
								<label>
									<input
										type="checkbox"
										name="required"
										bind:checked={it.required}
										onchange={() => {
											if (it.required && it.forbidden) {
												it.forbidden = false;
											}
										}}
									/>
									{t.calibration.required}
								</label>
								<label>
									<input
										type="checkbox"
										name="forbidden"
										bind:checked={it.forbidden}
										onchange={() => {
											if (it.required && it.forbidden) {
												it.required = false;
											}
										}}
									/>
									{t.calibration.forbidden}
								</label>
							</div>
						</div>
					{/each}
				</div>
				<form
					class="w-full"
					method="post"
					action="?/saveLabels"
					autocomplete="off"
					use:enhance={() => {
						return async ({ update }) => {
							update({ reset: false, invalidateAll: true });
						};
					}}
				>
					<input type="hidden" name="id" value={c.id} />
					<input type="hidden" name="itineraries" value={c.itineraries} />
					<Button class="w-full" type="submit" variant="default">
						<Save />
						{t.calibration.saveLabels}
					</Button>
				</form>
			</div>
			<div class="flex grow flex-col gap-2 p-1">
				<div class="flex grow flex-row border-2 border-solid items-center justify-center">
					TODO Visualization
				</div>
				<div class="flex flex-row justify-end">
					<form
						method="post"
						action="?/deleteCalibrationSet"
						autocomplete="off"
						use:enhance={() => {
							return async ({ update }) => {
								update({ reset: false, invalidateAll: true });
							};
						}}
					>
						<input type="hidden" name="id" value={c.id} />
						<Button type="submit" variant="default" size="default">
							<Trash />
							{t.calibration.deleteCalibrationSet}
						</Button>
					</form>
				</div>
			</div>
		</div>
	{/each}

	<Button variant="default" size="default" onclick={() => goto('/routing')}>
		<ListPlus />
		{t.calibration.addCalibrationSet}
	</Button>
</div>
