<script lang="ts">
	import { t } from '$lib/i18n/translation';
	import * as Table from '$lib/shadcn/table/index';
	import DisplayAddresses from './DisplayAddresses.svelte';

	type FavouriteRoute = {
		fromAddress: string;
		fromLat: number;
		fromLng: number;
		fromLevel: number;
		toAddress: string;
		toLat: number;
		toLng: number;
		toLevel: number;
	};
	let {
		favourites,
		selectedFavourite = $bindable()
	}: {
		favourites: FavouriteRoute[];
		selectedFavourite?: FavouriteRoute[];
	} = $props();

	let favouriteRows = $derived(favourites);
</script>

<div>
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head class="pb-4 pt-2">
					{t.favourites}
				</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each favouriteRows as row}
				<Table.Row
					class={'cursor-pointer'}
					onclick={() => {
						selectedFavourite = [row];
					}}
				>
					<Table.Cell>
						<DisplayAddresses fromAddress={row.fromAddress} toAddress={row.toAddress} />
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
</div>
