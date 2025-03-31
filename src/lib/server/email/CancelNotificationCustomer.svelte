<script lang="ts">
	import EmailFooter from './EmailFooter.svelte';
	const { name, start, target, startTime } = $props();

	const startDate = new Date(startTime);
	const today = new Date(Date.now());
	const isToday =
		new Date(
			startDate.getUTCFullYear(),
			startDate.getUTCMonth(),
			startDate.getUTCDate()
		).getTime() ===
		new Date(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()).getTime();
</script>

<div>
	Guten Tag {name},
	<p>
		Ihre Fahrt von {start} nach {target}, die {isToday
			? 'heute'
			: 'am ' + startDate.toLocaleDateString('de')} um
		{startDate.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })} beginnen sollte wurde
		storniert.
	</p>

	<EmailFooter />
</div>
