<script lang="ts">
	import { formatTime } from '$lib/util/formatTime';
	import EmailFooter from './EmailFooter.svelte';
	const { name, start, target, startTime } = $props();
</script>

<div>
	Guten Tag {name},
	<p>
		Ihre Fahrt von {start} nach {target}, die am {formatTime(startTime)} beginnen sollte wurde storniert.
	</p>

	<EmailFooter />
</div>
