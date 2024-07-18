<script>
	import '../../app.css';
	import Nav from '$lib/nav.svelte';

	const { children } = $props();
	const routeLinks = [
		{
			name: 'Freischaltung',
			href: '/activation'
		},
		{
			name: 'abgeschlossene Fahrten',
			href: '/completed_tours'
		}
	];
</script>

<div class="flex min-h-screen">
	<div class="container min-w-[1440px] relative mt-28">
		<section>
			<Nav {routeLinks} />
			<div class="overflow-hidden rounded-[0.5rem] border bg-background shadow-xl">
				{@render children()}
			</div>
		</section>
	</div>
</div>
