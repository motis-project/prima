<script lang="ts">
	import { type TourDetails } from '$lib/TourDetails.js';
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';
	import ChevronRight from 'lucide-svelte/icons/chevron-right';
	import { ChevronsRight, ChevronsLeft } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import Label from '$lib/components/ui/label/label.svelte';
	import { isPageValid, setCurrentPages } from '$lib/Paginate';

	class Props {
		open!: {
			page: number;
			currentPageRows: TourDetails[];
			totalPages: TourDetails[][];
		};
	}
	const { open = $bindable() }: Props = $props();
</script>

<div class="flex justify-center">
	{#if open.totalPages.length > 10}
		<Button
			variant="outline"
			on:click={() => {
				open.page = 0;
				open.currentPageRows = setCurrentPages(open.page, open.totalPages);
			}}
		>
			<ChevronsLeft class="mx-1 h-4 w-4" />
			Erste Seite
		</Button>
		<Button
			variant="outline"
			on:click={() => {
				open.page = isPageValid(open.page - 1, open.totalPages.length) ? open.page - 1 : open.page;
				open.currentPageRows = setCurrentPages(open.page, open.totalPages);
			}}
		>
			<ChevronLeft class="h-4 w-4" />
			Vorherige
		</Button>
		<Button
			variant="outline"
			on:click={() => {
				open.page = isPageValid(open.page + 1, open.totalPages.length) ? open.page + 1 : open.page;
				open.currentPageRows = setCurrentPages(open.page, open.totalPages);
			}}
		>
			Nächste
			<ChevronRight class="h-4 w-4" />
		</Button>
		<Button
			variant="outline"
			on:click={() => {
				open.page = open.totalPages.length - 1;
				open.currentPageRows = setCurrentPages(open.page, open.totalPages);
			}}
		>
			Letzte Seite
			<ChevronsRight class="mx-1 h-4 w-4" />
		</Button>
	{:else}
		<Button
			variant="outline"
			on:click={() => {
				open.page = isPageValid(open.page - 1, open.totalPages.length) ? open.page - 1 : open.page;
				open.currentPageRows = setCurrentPages(open.page, open.totalPages);
			}}
		>
			<ChevronLeft class="h-4 w-4" />
			Vorherige Seite
		</Button>
		{#each open.totalPages as _page, i}
			<Button
				variant="outline"
				on:click={() => {
					open.page = i;
					open.currentPageRows = setCurrentPages(open.page, open.totalPages);
				}}
			>
				{i + 1}
			</Button>
		{/each}
		<Button
			variant="outline"
			on:click={() => {
				open.page = isPageValid(open.page + 1, open.totalPages.length) ? open.page + 1 : open.page;
				open.currentPageRows = setCurrentPages(open.page, open.totalPages);
			}}
		>
			Nächste Seite
			<ChevronRight class="h-4 w-4" />
		</Button>
	{/if}
	<Label class="mx-2 mt-2.5">
		Auf Seite {open.page + 1} von {open.totalPages.length}
	</Label>
</div>
