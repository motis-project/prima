<script lang="ts" generics="T">
	import * as Table from '$lib/shadcn/table/index';
	import { ChevronsUpDown } from 'lucide-svelte';
	import { Button } from '$lib/shadcn/button';
	import type { Column } from './tableData';

	let {
		rows = $bindable(),
		cols,
		getRowStyle,
		selectedRow = $bindable(),
		bindSelectedRow,
		fixLastRow
	}: {
		rows: T[];
		cols: {
			text: string[];
			sort?: (r1: T, r2: T) => number;
			toTableEntry: (r: T) => string | number;
			toColumnStyle?: (r: T) => string;
			hidden?: boolean;
		}[];
		getRowStyle?: (row: T) => string;
		selectedRow?: undefined | T[];
		bindSelectedRow?: boolean;
		fixLastRow?: boolean;
	} = $props();

	const descending = Array.from({ length: cols.length }, () => true);
	const sortAndToggle = (idx: number) => {
		rows.sort(cols[idx].sort);
		if (!descending[idx]) {
			rows.reverse();
			if (fixLastRow) {
				rows = rows.splice(1).concat([rows[0]]);
			}
		} else {
			for (let i = 0; i < descending.length; i++) {
				if (i != idx) descending[i] = true;
			}
		}
		descending[idx] = !descending[idx];
	};
</script>

{#snippet tableHead(text: string[], i: number, sort: boolean)}
	{#if sort}
		<Table.Head class="pb-4 pt-2">
			<Button class="px-0 hover:no-underline" variant="link" onclick={() => sortAndToggle(i)}>
				{#each text as line}
					{line}<br />
				{/each}
				<ChevronsUpDown />
			</Button>
		</Table.Head>
	{:else}
		<Table.Head class="pb-4 pt-2">
			{#each text as line}
				{line}<br />
			{/each}
		</Table.Head>
	{/if}
{/snippet}

<div>
	<Table.Root>
		<Table.Header>
			<Table.Row>
				{#each cols as col, i}
					{#if !col.hidden}
						{@render tableHead(col.text, i, col.sort != undefined)}
					{/if}
				{/each}
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each rows as row}
				<Table.Row
					class={`${getRowStyle === undefined ? '' : getRowStyle(row)}`}
					onclick={() => {
						if (bindSelectedRow) {
							selectedRow = [row];
						}
					}}
				>
					{#each cols as col}
						{#if !col.hidden}
							<Table.Cell class={col.toColumnStyle ? col.toColumnStyle(row) : ''}>
								{col.toTableEntry(row)}
							</Table.Cell>
						{/if}
					{/each}
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
</div>
