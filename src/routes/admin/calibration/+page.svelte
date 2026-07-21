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
	import {
		Save,
		Check,
		MapIcon,
		X,
		ListPlus,
		Trash,
		CircleCheck,
		CircleX,
		ChevronLeft,
		HardDriveUpload,
		ArrowLeftRight,
		Import
	} from 'lucide-svelte';
	import PopupMap from '$lib/ui/PopupMap.svelte';
	import ItinerarySummary from '../../(customer)/routing/ItinerarySummary.svelte';
	import { filterTaxis, getCostFn } from '$lib/util/filterTaxis';
	import { page } from '$app/state';
	import ConnectionDetail from '../../(customer)/routing/ConnectionDetail.svelte';
	import { onClickStop, onClickTrip } from '$lib/util/onClick';
	import StopTimes from '../../(customer)/routing/StopTimes.svelte';
	import { vis } from './vis';
	import { HoverCard, HoverCardTrigger, HoverCardContent } from '$lib/shadcn/hover-card';
	import { usesTaxi } from '$lib/util/itineraryHelpers';
	import * as Dialog from '$lib/shadcn/dialog';

	const { data } = $props();

	let perTransfer = $state(data.filterSettings?.perTransfer ?? 8.0);
	let taxiBase = $state(data.filterSettings?.taxiBase ?? 20.6);
	let taxiPerMinute = $state(data.filterSettings?.taxiPerMinute ?? 4.9);
	let taxiDirectPenalty = $state(data.filterSettings?.taxiDirectPenalty ?? 20.0);
	let ptSlope = $state(data.filterSettings?.ptSlope ?? 2.2);
	let taxiSlope = $state(data.filterSettings?.taxiSlope ?? 2.0);
	let calibrationSets = $state(data.calibrationSets);
	let deletionArmed = $state(new Array<boolean>(data.calibrationSets.length));
	let deployArmed = $state(false);
	let importJson = $state(
		JSON.stringify({ filterSettings: data.filterSettings, calibrationSets: data.calibrationSets })
	);

	$effect(() => {
		deletionArmed = new Array<boolean>(calibrationSets.length);
	});

	$effect(() => {
		const getCost = getCostFn(perTransfer, taxiBase, taxiPerMinute, taxiDirectPenalty);
		calibrationSets.forEach((c, cI) => {
			const filterResult = filterTaxis(
				c.itineraries,
				perTransfer,
				taxiBase,
				taxiPerMinute,
				taxiDirectPenalty,
				ptSlope,
				taxiSlope,
				true
			);

			for (const i of c.itineraries) {
				if (i.keep || i.remove) {
					const found = filterResult.itineraries.find((x) => x === i) !== undefined;
					i.fulfilled = (i.keep && found) || (i.remove && !found);
				} else {
					i.fulfilled = true;
				}
			}

			const div = document.getElementById('vis' + cI);
			if (filterResult.visualize === undefined || div === null) {
				return;
			}
			vis(c.itineraries, filterResult.visualize, div, getCost);
		});
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
	<div class="fixed z-50 left-0 top-0 flex w-full flex-row gap-2 bg-gray-600 p-1">
		<form
			method="post"
			action="?/apply"
			autocomplete="off"
			class="flex w-full flex-row items-center justify-center gap-4"
		>
			<span class="flex flex-row items-center gap-1"
				><Label for="perTransfer">{t.calibration.perTransfer}</Label>
				<Input
					class="w-24"
					name="perTransfer"
					type="number"
					min="0"
					step="any"
					bind:value={perTransfer}
				/></span
			>
			<span class="flex flex-row items-center gap-1">
				<Label for="taxiBase">{t.calibration.taxiBase}</Label>
				<Input
					class="w-24"
					name="taxiBase"
					type="number"
					min="0"
					step="any"
					bind:value={taxiBase}
				/>
			</span>
			<span class="flex flex-row items-center gap-1">
				<Label for="taxiPerMinute">{t.calibration.taxiPerMinute}</Label>
				<Input
					class="w-24"
					name="taxiPerMinute"
					type="number"
					min="0"
					step="any"
					bind:value={taxiPerMinute}
				/>
			</span>
			<span class="flex flex-row items-center gap-1">
				<Label for="taxiDirectPenalty">{t.calibration.taxiDirectPenalty}</Label>
				<Input
					class="w-24"
					name="taxiDirectPenalty"
					type="number"
					min="0"
					step="any"
					bind:value={taxiDirectPenalty}
				/>
			</span>
			<span class="flex flex-row items-center gap-1">
				<Label for="ptSlope">{t.calibration.ptSlope}</Label>
				<Input class="w-24" name="ptSlope" type="number" min="0" step="any" bind:value={ptSlope} />
			</span>
			<span class="flex flex-row items-center gap-1">
				<Label for="taxiSlope">{t.calibration.taxiSlope}</Label>
				<Input
					class="w-24"
					name="taxiSlope"
					type="number"
					min="0"
					step="any"
					bind:value={taxiSlope}
				/>
			</span>

			<HoverCard>
				<HoverCardTrigger>
					<div class="flex flex-row gap-2">
						<Button variant="default" size="default" onclick={() => (deployArmed = true)}>
							<HardDriveUpload /> Deploy
						</Button>
						{#if deployArmed}
							<Button type="submit" variant="default" size="default" class="bg-green-500">
								<Check />
							</Button>
							<Button
								variant="default"
								size="default"
								class="bg-red-500"
								onclick={() => (deployArmed = false)}
							>
								<X />
							</Button>
						{/if}
					</div>
				</HoverCardTrigger>
				<HoverCardContent side="bottom" class="flex justify-center">
					<p>{t.calibration.deploy}</p>
				</HoverCardContent>
			</HoverCard>
		</form>
		<Dialog.Root>
			<Dialog.Trigger><Button class=""><ArrowLeftRight />JSON</Button></Dialog.Trigger>
			<Dialog.Content class="flex h-2/3 w-2/3 flex-col">
				<Dialog.Header>JSON Import/Export</Dialog.Header>
				<textarea class="h-full w-full flex-grow bg-black" bind:value={importJson}></textarea>
				<Dialog.Close>
					<form method="post" action="?/import">
						<input type="hidden" name="importJson" value={importJson} />
						<Button type="submit"><Import />Import</Button>
					</form>
				</Dialog.Close>
			</Dialog.Content>
		</Dialog.Root>
	</div>

	<div class="flex w-[99vw] flex-col items-center gap-4 pt-6">
		{#each calibrationSets as c, cI}
			<div class="flex h-[80vh] w-full rounded-lg border-2 border-solid">
				<div class="flex flex-col gap-2 p-1">
					<Input class="font-bold" type="text" name="name" bind:value={c.name} />
					<div class="overflow-auto rounded-lg border-2 border-solid">
						{#each c.itineraries as it}
							<div class="flex flex-col p-1">
								<button
									onclick={() => {
										pushState('', { selectedItinerary: $state.snapshot(it) });
									}}
								>
									<ItinerarySummary {it} />
								</button>
								{#if usesTaxi(it)}
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
								{/if}
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
							<Save />{t.calibration.save}
						</Button>
					</form>
				</div>
				<div class="flex grow flex-col gap-2 p-1">
					<div id={'vis' + cI} class="flex grow flex-row items-center justify-center"></div>
					<div class="flex flex-row justify-end">
						<form method="post" action="?/delete" autocomplete="off">
							<input type="hidden" name="id" value={c.id} />
							<Button variant="default" size="default" onclick={() => (deletionArmed[cI] = true)}>
								<Trash />{t.calibration.delete}
							</Button>
							{#if deletionArmed[cI]}
								<Button type="submit" variant="default" size="default" class="bg-green-500">
									<Check />
								</Button>
								<Button
									variant="default"
									size="default"
									class="bg-red-500"
									onclick={() => (deletionArmed[cI] = false)}
								>
									<X />
								</Button>
							{/if}
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
