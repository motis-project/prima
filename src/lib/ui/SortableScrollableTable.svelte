<script lang="ts" generics="T">
	import * as Table from '$lib/shadcn/table/index';
	import { ChevronsUpDown } from 'lucide-svelte';
	import { Button } from '$lib/shadcn/button';

	const {
		rows,
		cols
	}: {
		rows: T[];
		cols: {
			text: string;
			sort: undefined | ((r1: T, r2: T) => number);
			toTableEntry: (r: T) => string | number;
		}[];
	} = $props();

	const descending = Array.from({ length: cols.length }, () => true);
	const sort = (idx: number) => {
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
</script>

<sortableScrollableTable>
	<div class="min-w-[160vh]">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					{#each cols as col, i}
						{#if col.sort != undefined}
							<Table.Head>
								<Button class="whitespace-pre" variant="outline" onclick={() => sort(i)}>
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
					<Table.Row>
						{#each cols as col}
							<Table.Cell>{col.toTableEntry(row)}</Table.Cell>
						{/each}
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
</sortableScrollableTable>
