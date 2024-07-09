<script>
	import '../../app.css';
	import Nav from '$lib/components/ui/nav.svelte';
</script>

<div class="flex min-h-screen">
	<div class="container min-w-[1440px] relative pb-10 mt-[5%]">
		<section>
			<Nav />
			<div class="overflow-hidden rounded-[0.5rem] border bg-background shadow-xl">
				<slot />
			</div>
		</section>
	</div>
</div>
