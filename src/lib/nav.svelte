<script lang="ts">
	import { cubicInOut } from 'svelte/easing';
	import { crossfade } from 'svelte/transition';
	import { page } from '$app/stores';
	import { cn } from '$lib/utils.js';
	import { Button } from './components/ui/button';
	import Logout from 'lucide-svelte/icons/log-out';

	type Props = {
		className?: string;
		routeLinks: RouteLink[];
	};
	let { routeLinks, className, ...restProps }: Props = $props();

	const [send, receive] = crossfade({
		duration: 250,
		easing: cubicInOut
	});

	type RouteLink = {
		name: string;
		href: string;
	};
</script>

<div class="relative">
	<div class="lg:max-w-none">
		<div
			class={cn('mb-4 flex items-center justify-between overflow-y-auto pb-3 md:pb-0', className)}
			{...restProps}
		>
			<div class="w-full flex">
				{#each routeLinks as routeLink, index (index)}
					{@const isActive =
						// eslint-disable-next-line
						$page.url.pathname.startsWith(routeLink.href)}

					<a
						href={routeLink.href}
						data-sveltekit-noscroll
						class={cn(
							'relative flex h-7 items-center justify-center rounded-full px-4 text-center text-sm transition-colors hover:text-primary font-bold',
							isActive ? 'font-bold text-primary' : 'text-muted-foreground'
						)}
					>
						{#if isActive}
							<div
								class="absolute inset-0 rounded-full bg-muted"
								in:send={{ key: 'activetab' }}
								out:receive={{ key: 'activetab' }}
							></div>
						{/if}
						<div class="relative">
							{routeLink.name}
						</div>
					</a>
				{/each}
			</div>
			<div>
				<Button
					variant="ghost"
					data-sveltekit-preload-data="off"
					href="/forgotPassword/changePassword"
				>
					Passwort ändern
				</Button>
			</div>
			<div>
				<Button variant="ghost" data-sveltekit-preload-data="off" href="/logout">
					<Logout class="mr-2 h-4 w-4" />
					Ausloggen
				</Button>
			</div>
		</div>
	</div>
</div>
