<script>
	import '../../app.css';
	import Nav from '$lib/nav.svelte';

	const { data } = $props();
	const routeLinks = data.user.is_maintainer
		? [
				{
					name: 'Freischaltung',
					href: '/activation'
				},
				{
					name: 'Tourenliste',
					href: '/completed'
				}
			]
		: data.user.is_entrepreneur
			? [
					{
						name: 'Taxi',
						href: '/taxi'
					},
					{
						name: 'Stammdaten',
						href: '/company'
					}
				]
			: [];
</script>

<div class="flex min-h-screen">
	<div class="container min-w-[1440px] relative mt-28">
		<section>
			<Nav {routeLinks} />
			<div class="overflow-hidden rounded-[0.5rem] border bg-background shadow-xl">
				<slot />
			</div>
		</section>
	</div>
</div>
