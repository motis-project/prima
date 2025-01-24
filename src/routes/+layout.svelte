<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<div class="md:flex md:h-full md:items-center md:justify-center">
	{@render children()}
</div>
