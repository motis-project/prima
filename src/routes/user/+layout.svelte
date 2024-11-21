<script>
	import '../../app.css';
	import Nav from '$lib/nav.svelte';

	const { children } = $props();
	const routeLinks = [
		{
			name: 'Taxi',
			href: '/user/taxi'
		},
		{
			name: 'Stammdaten',
			href: '/user/company'
		},
		{
			name: 'Abgeschlossene Fahrten',
			href: '/user/tours'
		},
		{
			name: 'Fahrer',
			href: '/user/drivers'
		},
		{
			name: 'Verwaltung',
			href: '/user/administration'
		}
	];
</script>

<div class="flex max-h-screen">
	<div class="container min-w-[1440px] relative my-20">
		<section>
			<Nav {routeLinks} />
			<div class="overflow-hidden rounded-[0.5rem] border bg-background shadow-xl">
				{@render children()}
			</div>
		</section>
	</div>
</div>
