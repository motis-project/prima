<script lang="ts">
	import { PUBLIC_PROVIDER } from '$env/static/public';
	import { enhance } from '$app/forms';
	import { goto, pushState } from '$app/navigation';
	import { t } from '$lib/i18n/translation';
	import { Input } from '$lib/shadcn/input';
	import Label from '$lib/shadcn/label/label.svelte';
	import { Button } from '$lib/shadcn/button';
	import Separator from '$lib/shadcn/separator/separator.svelte';
	import Meta from '$lib/ui/Meta.svelte';
	import ArrowDownToLine from 'lucide-svelte/icons/arrow-down-to-line';
	import Save from 'lucide-svelte/icons/save';
	import ListPlus from 'lucide-svelte/icons/list-plus';
	import Trash from 'lucide-svelte/icons/trash';
	import CircleCheck from 'lucide-svelte/icons/circle-check';
	import CircleX from 'lucide-svelte/icons/circle-x';
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';
	import { MapIcon } from 'lucide-svelte';
	import PopupMap from '$lib/ui/PopupMap.svelte';
	import ItinerarySummary from '../../(customer)/routing/ItinerarySummary.svelte';
	import type { CalibrationItinerary } from '$lib/calibration';
	import { filterTaxis } from '$lib/util/filterTaxis';
	import { page } from '$app/state';
	import ConnectionDetail from '../../(customer)/routing/ConnectionDetail.svelte';
	import { onClickStop, onClickTrip } from '$lib/util/onClick';
	import StopTimes from '../../(customer)/routing/StopTimes.svelte';
	import Plotly from 'plotly.js';

	const { data } = $props();

	let perTransfer = $state(data.filterSettings?.perTransfer ?? 8.0);
	let taxiBase = $state(data.filterSettings?.taxiBase ?? 20.6);
	let taxiPerMinute = $state(data.filterSettings?.taxiPerMinute ?? 4.9);
	let taxiDirectPenalty = $state(data.filterSettings?.taxiDirectPenalty ?? 20.0);
	let ptSlope = $state(data.filterSettings?.ptSlope ?? 2.2);
	let taxiSlope = $state(data.filterSettings?.taxiSlope ?? 2.0);
	let calibrationSets = $state(data.calibrationSets);

	let filterResults = new Array<[Array<CalibrationItinerary>, Array<number>, Array<number>]>();
	$effect(() => {
		filterResults = [];
		for (const c of calibrationSets) {
			filterResults.push(
				filterTaxis(
					c.itineraries,
					perTransfer,
					taxiBase,
					taxiPerMinute,
					taxiDirectPenalty,
					ptSlope,
					taxiSlope
				)
			);
			for (const it of c.itineraries) {
				if (it.keep || it.remove) {
					const found =
						filterResults
							.at(-1)
							?.at(0)
							?.find((x) => x === it) !== undefined;
					it.fulfilled = (it.keep && found) || (it.remove && !found);
				} else {
					it.fulfilled = true;
				}
			}
		}
	});
</script>

<Meta title={PUBLIC_PROVIDER} />

<div>
{#if page.state.showMap}
	<PopupMap
		itinerary={page.state.selectedItinerary}
		areas={data.areas}
		rideSharingBounds={data.rideSharingBounds}
	/>
{:else if page.state.selectedItinerary}
		<div class="flex items-center justify-between gap-4">
			<Button variant="outline" size="icon" onclick={() => window.history.back()}>
				<ChevronLeft />
			</Button>
			<Button
				size="icon"
				variant="outline"
				onclick={() =>
					pushState('', { showMap: true, selectedItinerary: page.state.selectedItinerary })}
			>
				<MapIcon class="h-[1.2rem] w-[1.2rem]" />
			</Button>
		</div>
		<Separator class="my-4" />
		<ConnectionDetail itinerary={page.state.selectedItinerary} {onClickStop} {onClickTrip} />	
{:else if page.state.stop}
	<Button variant="outline" size="icon" onclick={() => window.history.back()}>
		<ChevronLeft />
	</Button>
	<StopTimes
		arriveBy={false}
		time={page.state.stop.time}
		stopId={page.state.stop.stopId}
		{onClickTrip}
	/>
{/if}
</div>

<div class="contents" class:hidden={page.state.stop || page.state.selectedItinerary}>
	<div class="flex flex-col gap-4">
		<p class="ml-4">{t.calibration.greeter}</p>
		<form
			method="post"
			action="?/apply"
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

			<Button type="submit">
				<ArrowDownToLine />
			</Button>
		</form>

		{#each calibrationSets as c}
			<div class="flex h-[80vh] rounded-lg border-2 border-solid">
				<div class="flex flex-col gap-2 p-1">
					<Input class="font-bold" type="text" name="name" bind:value={c.name} />
					<div class="overflow-auto rounded-lg border-2 border-solid">
						{#each c.itineraries as it}
							<div class="flex flex-col p-1">
								<button
									onclick={() => {
										pushState('', { selectedItinerary: $state.snapshot(it) } );
									}}
								>
									<ItinerarySummary {it} />
								</button>
								<div class="flex gap-2 rounded-lg border-x-2 border-b-2 px-2 pt-1 text-sm">
									<label>
										<input
											type="checkbox"
											name="required"
											bind:checked={it.keep}
											onchange={() => {
												if (it.keep && it.remove) {
													it.remove = false;
												}
											}}
										/>
										{t.calibration.keep}
									</label>
									<label>
										<input
											type="checkbox"
											name="forbidden"
											bind:checked={it.remove}
											onchange={() => {
												if (it.keep && it.remove) {
													it.keep = false;
												}
											}}
										/>
										{t.calibration.remove}
									</label>
									{#if it.fulfilled}
										<CircleCheck class="h-5 w-5 text-green-500" />
									{:else}
										<CircleX class="h-5 w-5 text-red-500" />
									{/if}
								</div>
							</div>
						{/each}
					</div>
					<form
						method="post"
						action="?/save"
						autocomplete="off"
						use:enhance={() => {
							return async ({ update }) => {
								update({ reset: false, invalidateAll: true });
							};
						}}
					>
						<input type="hidden" name="id" value={c.id} />
						<input type="hidden" name="name" value={c.name} />
						<input type="hidden" name="itineraries" value={JSON.stringify(c.itineraries)} />
						<Button class="w-full" type="submit" variant="default">
							<Save />
						</Button>
					</form>
				</div>
				<div class="flex grow flex-col gap-2 p-1">
					<div class="flex grow flex-row items-center justify-center border-2 border-solid">
						TODO Visualization
					</div>
					<div class="flex flex-row justify-end">
						<form
							method="post"
							action="?/delete"
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
</div>
