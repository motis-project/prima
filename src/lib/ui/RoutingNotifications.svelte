<script lang="ts">
	import { goto } from '$app/navigation';
	import { t } from '$lib/i18n/translation';
	import * as Card from '$lib/shadcn/card';
	import SortableTable from './SortableTable.svelte';
	type Notification = {
		fromAddress: string;
		toAddress: string;
		time: number;
		startFixed: boolean;
		luggage: number;
		passengers: number;
		url: string;
	};

	const {
		rows
	}: {
		rows: Notification[];
	} = $props();
	const cols = [
		{
			text: [t.from],
			sort: (a: Notification, b: Notification) => a.fromAddress.localeCompare(b.fromAddress),
			toTableEntry: (r: Notification) => r.fromAddress
		},
		{
			text: [t.to],
			sort: (a: Notification, b: Notification) => a.toAddress.localeCompare(b.toAddress),
			toTableEntry: (r: Notification) => r.toAddress
		},
		{
			text: [t.when],
			sort: (a: Notification, b: Notification) => a.time - b.time,
			toTableEntry: (r: Notification) =>
				t.atDateTime(
					r.startFixed ? 'arrival' : 'departure',
					new Date(r.time),
					new Date(r.time).toLocaleDateString() == new Date().toLocaleDateString()
				)
		}
	];
	let selectedRow: Notification[] | undefined = $state(undefined);
	$effect(() => {
		if (selectedRow !== undefined && selectedRow.length !== 0) {
			goto(selectedRow[0].url);
			selectedRow = undefined;
		}
	});
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{t.notificationsList}</Card.Title>
	</Card.Header>

	<Card.Content>
		<SortableTable
			{rows}
			{cols}
			bind:selectedRow
			bindSelectedRow={true}
			getRowStyle={(_) => 'cursor-pointer '}
		/>
	</Card.Content>
</Card.Root>
