<script lang="ts">
	import { t } from '$lib/i18n/translation';
	import type { Column } from './tableData';
	import SortableTable from './SortableTable.svelte';
	import * as Card from '$lib/shadcn/card';

	let {
		favourites,
		selectedFav = $bindable()
	}: {
		favourites: { address: string; lat: number; lng: number; level: number }[];
		selectedFav?: { address: string; lat: number; lng: number; level: number }[];
	} = $props();

	let favRows = $derived(favourites);

	const favouritesCols: Column<{ address: string; lat: number; lng: number }>[] = [
		{
			text: [t.favourites],
			sort: undefined,
			toTableEntry: (r: { address: string }) => r.address
		}
	];
</script>

{#if favRows.length != 0}
	<Card.Root class="mt-5">
		<Card.Content>
			<SortableTable
				getRowStyle={(_) => 'cursor-pointer '}
				rows={favRows}
				cols={favouritesCols}
				bind:selectedRow={selectedFav}
				bindSelectedRow={true}
			/>
		</Card.Content></Card.Root
	>
{/if}
