<script lang="ts">
	import type { Msg } from '$lib/msg';
	import CircleAlert from 'lucide-svelte/icons/circle-alert';
	import * as Alert from '$lib/shadcn/alert';
	import { t } from './i18n/translation';

	const { msg, class: className }: { msg: Msg; class?: string } = $props();
</script>

<Alert.Root variant={msg.type === 'success' ? 'default' : 'destructive'}>
	<CircleAlert class="size-4" />
	<Alert.Title>{msg.type == 'success' ? 'Erfolg!' : 'Fehler!'}</Alert.Title>
	<Alert.Description>
		{t.msg[msg.text]}
	</Alert.Description>
</Alert.Root>
