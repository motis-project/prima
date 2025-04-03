<script lang="ts">
	import CircleAlert from 'lucide-svelte/icons/circle-alert';
	import * as Alert from '$lib/shadcn/alert';
	import { type Msg } from '$lib/msg';
	import { t } from '$lib/i18n/translation';
	import type { FadeParams, TransitionConfig } from 'svelte/transition';

	const { msg, class: className, fadeDuration }: { msg: Msg | undefined; class?: string; fadeDuration?: number } = $props();

	function fade(_: Element, { delay, duration }: FadeParams): TransitionConfig {
		return duration == undefined ? {} : {
			delay,
			duration,
			css: (t) => {
				return `opacity: ${t};`;
			}
		};
	}
</script>

{#if msg}
	<div
		transition:fade={{
			delay: 0,
			duration: fadeDuration
		}}
	>
		<Alert.Root class={className} variant={msg.type === 'success' ? 'default' : 'destructive'}>
			<CircleAlert class="size-4" />
			<Alert.Description>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html t.msg[msg.text]}
			</Alert.Description>
		</Alert.Root>
	</div>
{/if}
