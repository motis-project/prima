<script lang="ts" generics="T">
	import * as Table from '$lib/shadcn/table/index';
	import { ChevronsUpDown } from 'lucide-svelte';
	import { Button } from '$lib/shadcn/button';
	import type { TourWithRequests } from '$lib/util/getToursTypes';

	let {
		rows,
		cols,
		getRowStyle,
		selectedRow = $bindable()
	}: {
		rows: T[];
		cols: {
			text: string;
			sort: undefined | ((r1: T, r2: T) => number);
			toTableEntry: (r: T) => string | number;
		}[];
		isAdmin: boolean;
		getRowStyle?: (row: T) => string;
		selectedRow?: undefined | T[];
	} = $props();

	const descending = Array.from({ length: cols.length }, () => true);
	const sortAndToggle = (idx: number) => {
		rows.sort(cols[idx].sort);
		if (!descending[idx]) {
			rows.reverse();
		} else {
			for (let i = 0; i < descending.length; i++) {
				if (i != idx) descending[i] = true;
			}
		}
		descending[idx] = !descending[idx];
	};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function isTourWithRequests(data: any): data is TourWithRequests {
		return data && typeof data.tourId === 'number' && Array.isArray(data.requests);
	}
</script>

<div class="min-w-[160vh]">
	<Table.Root>
		<Table.Header>
			<Table.Row>
				{#each cols as col, i}
					{#if col.sort != undefined}
						<Table.Head>
							<Button
								class="px-0 hover:no-underline"
								variant="link"
								onclick={() => sortAndToggle(i)}
							>
								{col.text}
								<ChevronsUpDown class="h-6 w-4" />
							</Button>
						</Table.Head>
					{:else}
						<Table.Head>{col.text}</Table.Head>
					{/if}
				{/each}
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each rows as row}
				<Table.Row
					class={`${getRowStyle === undefined ? '' : getRowStyle(row)}`}
					onclick={() => {
						if (isTourWithRequests(row)) {
							selectedRow = [row];
						}
					}}
				>
					{#each cols as col}
						<Table.Cell>{col.toTableEntry(row)}</Table.Cell>
					{/each}
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
</div>
