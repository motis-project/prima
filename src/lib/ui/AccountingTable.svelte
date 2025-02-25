<script lang="ts">
	import * as Card from '$lib/shadcn/card';
	import * as Table from '$lib/shadcn/table/index';
	import * as Dialog from '$lib/shadcn/dialog/index';
	import { ChevronsUpDown } from 'lucide-svelte';
	import { Button, buttonVariants } from '$lib/shadcn/button';
	import Label from '$lib/shadcn/label/label.svelte';
	import { onMount } from 'svelte';
	import { getLocalTimeZone, today, CalendarDate } from '@internationalized/date';
	import { RangeCalendar } from '$lib/shadcn/range-calendar/index';
	import { paginate, setCurrentPages } from '$lib/Paginate';
	import Papa from 'papaparse';
	import pkg from 'file-saver';
	import Paginate from '$lib/paginate.svelte';
	import type { Tour, Tours } from '$lib/server/db/getTours';
	import { FIXED_PRICE } from '$lib/constants';

	let descending = [true, true, true];
	let perPage = 5;
	let firstPage =[].slice(0, perPage);
	let firstarray = [firstPage];
	let currentRows: Tour[] = [];

	let paginationInfo = $state<{
		page: number;
		currentPageRows: Tour[];
		totalPages: Tour[][];
	}>({ page: 0, currentPageRows: firstPage, totalPages: firstarray });

	const sortColumn = (idx: number) => {
		switch (idx) {
			case 0: {
				currentRows.sort((a, b) => a.startTime - b.startTime);
				break;
			}
			case 1: {
				currentRows.sort((a, b) => getTourCost(a) - getTourCost(b));
				break;
			}
			case 2: {
				currentRows.sort((a, b) => (a.fare ?? 0) - (b.fare ?? 0));
			}
			default:
				return;
		}
		if (!descending[idx]) {
			currentRows.reverse();
		} else {
			for (let i = 0; i < descending.length; i++) {
				if (i != idx) descending[i] = true;
			}
		}
		descending[idx] = !descending[idx];
		paginationInfo.totalPages = paginate(perPage, currentRows);
		paginationInfo.page = 0;
		paginationInfo.currentPageRows = setCurrentPages(
			paginationInfo.page,
			paginationInfo.totalPages
		);
	};

    const getCustomerCount = (tour: Tour) => {
        let customers = new Set<number>();
        tour.events.forEach((e) => {
            customers.add(e.customer!);
        });
        return customers.size;
    };
    
    const getTourCost = (tour: Tour) => {
        return Math.max(0, (tour.fare ?? 0) - FIXED_PRICE * getCustomerCount(tour));
    };
    
    const getEuroString = (price: number | null) => {
        return ((price ?? 0) / 100).toFixed(2);
    };
</script>

<Table.Root>
    <Table.Header>
        <Table.Row>
            <Table.Head class="mt-6.5">Unternehmen</Table.Head>
            <Table.Head class="mt-6.5">
                <Button class="whitespace-pre" variant="outline" onclick={() => sortColumn(0)}>
                    {'Abfahrt  '}
                    <ChevronsUpDown class="h-6 w-4" />
                </Button>
            </Table.Head>
            <Table.Head class="mt-6.5">Ankunft</Table.Head>
            <Table.Head class="mt-6.5 text-center">Anzahl Kunden</Table.Head>
            <Table.Head class="mt-6.5 text-center">
                <Button class="whitespace-pre" variant="outline" onclick={() => sortColumn(1)}>
                    {'Taxameterpreis  '}
                    <ChevronsUpDown class="h-6 w-4" />
                </Button>
            </Table.Head>
            <Table.Head class="mt-6.5 text-center">
                <Button class="whitespace-pre" variant="outline" onclick={() => sortColumn(2)}>
                    {'Kosten  '}
                    <ChevronsUpDown class="h-6 w-4" />
                </Button>
            </Table.Head>
        </Table.Row>
    </Table.Header>
    <Table.Body>
        {#each paginationInfo.currentPageRows as tour}
            <Table.Row>
                <Table.Cell>{tour.companyName}</Table.Cell>
                <Table.Cell>{new Date(tour.startTime).toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
                <Table.Cell>{new Date(tour.endTime).toLocaleString('de-DE').slice(0, -3)}</Table.Cell>
                <Table.Cell class="text-center">{getCustomerCount(tour)}</Table.Cell>
                <Table.Cell class="text-center">{getEuroString(tour.fare)} €</Table.Cell>
                <Table.Cell class="text-center">{getEuroString(getTourCost(tour))} €</Table.Cell>
            </Table.Row>
        {/each}
    </Table.Body>
</Table.Root>
