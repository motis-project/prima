<script>
	import '../../app.css';
	import Nav from '$lib/nav.svelte';

	const { children } = $props();
	const routeLinks = [
		{
			name: 'Taxi',
			href: '/taxi'
		},
		{
			name: 'Stammdaten',
			href: '/company'
		},
		{
			name: 'Abgeschlossene Fahrten',
			href: '/tours'
		},
		{
			name: 'Fahrer',
			href: '/drivers'
		}
	];
</script>

<div class="flex min-h-screen">
	<div class="container min-w-[1440px] relative my-20">
		<section>
			<Nav {routeLinks} />
			<div class="overflow-hidden rounded-[0.5rem] border bg-background shadow-xl">
				{@render children()}
			</div>
		</section>
	</div>
</div>
