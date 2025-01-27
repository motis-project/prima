<script lang="ts">
	import CircleAlert from 'lucide-svelte/icons/circle-alert';
	import * as Alert from '$lib/shadcn/alert';
	import { type Msg } from '$lib/msg';
	import { t } from '$lib/i18n/translation';

	const { msg, class: className }: { msg: Msg; class?: string } = $props();
</script>

<Alert.Root class={className} variant={msg.type === 'success' ? 'default' : 'destructive'}>
	<CircleAlert class="size-4" />
	<Alert.Title>{msg.type == 'success' ? 'Erfolg!' : 'Fehler!'}</Alert.Title>
	<Alert.Description>
		{@html t.msg[msg.text]}
	</Alert.Description>
</Alert.Root>
