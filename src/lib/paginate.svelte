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

	const setPage = (newPage: number) => {
		open.page = isPageValid(newPage, open.totalPages.length) ? newPage : open.page;
		open.currentPageRows = setCurrentPages(open.page, open.totalPages);
	};
</script>

<div class="flex justify-center">
	{#if open.totalPages.length > 10}
		<Button
			variant="outline"
			on:click={() => {
				setPage(0);
			}}
		>
			<ChevronsLeft class="mx-1 h-4 w-4" />
			Erste Seite
		</Button>
		<Button
			variant="outline"
			on:click={() => {
				setPage(open.page - 1);
			}}
		>
			<ChevronLeft class="h-4 w-4" />
			Vorherige
		</Button>
		<Button
			variant="outline"
			on:click={() => {
				setPage(open.page + 1);
			}}
		>
			Nächste
			<ChevronRight class="h-4 w-4" />
		</Button>
		<Button
			variant="outline"
			on:click={() => {
				setPage(open.totalPages.length - 1);
			}}
		>
			Letzte Seite
			<ChevronsRight class="mx-1 h-4 w-4" />
		</Button>
	{:else}
		<Button
			variant="outline"
			on:click={() => {
				setPage(open.page - 1);
			}}
		>
			<ChevronLeft class="h-4 w-4" />
			Vorherige Seite
		</Button>
		{#each open.totalPages as _page, i}
			<Button
				variant="outline"
				on:click={() => {
					setPage(i);
				}}
			>
				{i + 1}
			</Button>
		{/each}
		<Button
			variant="outline"
			on:click={() => {
				setPage(open.page + 1);
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
