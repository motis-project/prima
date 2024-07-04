<script>
	import '../app.css';
	import * as Card from '$lib/components/ui/card';
</script>

<div class="flex min-h-screen">
	<Card.Root class="w-fit m-auto min-w-[1280px]">
		<slot />
	</Card.Root>
</div>
