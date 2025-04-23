<script lang="ts">
	import { t } from '$lib/i18n/translation';
	import type { Column } from './tableData';
	import SortableTable from './SortableTable.svelte';
	import * as Card from '$lib/shadcn/card';

	export type Favourite = {
		address: string;
		lat: number;
		lng: number;
		level: number;
	};

	let {
		favourites,
		selectedFavourite = $bindable()
	}: {
		favourites: Favourite[];
		selectedFavourite?: Favourite[];
	} = $props();

	let favouriteRows = $derived(favourites);

	const favouriteCols: Column<{ address: string; lat: number; lng: number }>[] = [
		{
			text: [t.favourites],
			sort: undefined,
			toTableEntry: (r: { address: string }) => r.address
		}
	];
</script>

{#if favouriteRows.length != 0}
	<Card.Root class="mt-5">
		<Card.Content>
			<SortableTable
				getRowStyle={(_) => 'cursor-pointer '}
				rows={favouriteRows}
				cols={favouriteCols}
				bind:selectedRow={selectedFavourite}
				bindSelectedRow={true}
			/>
		</Card.Content>
	</Card.Root>
{/if}
