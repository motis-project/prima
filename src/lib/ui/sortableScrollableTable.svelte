<script lang="ts">
	import * as Table from '$lib/shadcn/table/index';
	import { ChevronsUpDown } from 'lucide-svelte';
	import { Button } from '$lib/shadcn/button';

    const { rows, cols } = $props();


	let descending = new Array<boolean>(cols.filter((c: {sort: any}) => c.sort != undefined).length);
    descending.map((_) => true);
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
    }
</script>

<sortableScrollableTable>
	<div class="h-[50vh] min-w-[130vh] overflow-y-auto">
	  <Table.Root class="w-full">
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
		            <Table.Cell>{col.toTableCell(row)}</Table.Cell>
                {/each}
		    </Table.Row>
		{/each}
		</Table.Body>
	  </Table.Root>
	</div>
</sortableScrollableTable>
