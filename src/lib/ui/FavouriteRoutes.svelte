<script lang="ts">
	import { t } from '$lib/i18n/translation';
	import * as Table from '$lib/shadcn/table/index';
	import MapPin from 'lucide-svelte/icons/map-pin';
	import Circle from 'lucide-svelte/icons/circle';
	import Dots from 'lucide-svelte/icons/ellipsis-vertical';

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
						<div class="grid grid-cols-[auto_1fr] grid-rows-[auto_auto_auto] gap-x-2">
							<div class="flex items-center justify-center">
								<Circle size={12} />
							</div>
							<div>{row.fromAddress}</div>
							<div class="flex flex-col items-center justify-center gap-1">
								<Dots size={13} />
							</div>
							<div></div>
							<div class="flex items-center justify-center">
								<MapPin size={12} />
							</div>
							<div>{row.toAddress}</div>
						</div>
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
</div>
