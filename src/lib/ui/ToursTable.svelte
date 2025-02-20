<script lang="ts">
	import type { Tour, TourEvent, Tours } from '$lib/server/db/getTours';
	import * as Table from '$lib/shadcn/table';
	import Panel from '$lib/ui/Panel.svelte';
	import { t } from '$lib/i18n/translation';
	import TourDialog from '$lib/ui/TourDialog.svelte';
	import { getTourInfoShort } from '$lib/util/getTourInfoShort';

	let {
		isAdmin,
		tours
	}: {
		isAdmin: boolean;
		tours: Tours;
	} = $props();

	let selectedTour = $state<{
		tours: Array<Tour> | undefined;
		isAdmin: boolean;
	}>({ tours: undefined, isAdmin });

	const getCustomerCount = (tour: Tour) => {
		let customers: Set<number> = new Set<number>();
		tour.events.forEach((e: TourEvent) => customers.add(e.customer));
		return customers.size;
	};
</script>

<Panel title={t.menu.completedTours} subtitle={t.admin.completedToursSubtitle}>
	<Table.Root>
		<Table.Header>
			<Table.Row>
				{#if isAdmin}
					<Table.Head>Unternehmen</Table.Head>
				{:else}
					<Table.Head>Fahrzeug</Table.Head>
				{/if}
				<Table.Head>Von</Table.Head>
				<Table.Head>Nach</Table.Head>
				<Table.Head>Abfahrt</Table.Head>
				<Table.Head>Ankunft</Table.Head>
				<Table.Head>Anzahl Kunden</Table.Head>
				<Table.Head>No-Show</Table.Head>
				<Table.Head>Anzahl Stationen</Table.Head>
				<Table.Head>Gesamtfahrpreis</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each tours as tour}
				<Table.Row
					onclick={() =>
						(selectedTour = {
							tours: [tour],
							isAdmin
						})}
					class={`cursor-pointer ${tour.cancelled ? 'bg-destructive' : 'bg-white-0'}`}
				>
					{#if isAdmin}
						<Table.Cell>{tour.companyName}</Table.Cell>
					{:else}
						<Table.Cell>{tour.licensePlate}</Table.Cell>
					{/if}
					<Table.Cell>{getTourInfoShort(tour).from}</Table.Cell>
					<Table.Cell>{getTourInfoShort(tour).to}</Table.Cell>
					<Table.Cell>{new Date(tour.startTime).toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
					<Table.Cell>{new Date(tour.endTime).toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
					<Table.Cell>{getCustomerCount(tour)}</Table.Cell>
					<Table.Cell>TODO</Table.Cell>
					<Table.Cell>{tour.events.length}</Table.Cell>
					<Table.Cell>TODO</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
</Panel>

<TourDialog bind:open={selectedTour} />
