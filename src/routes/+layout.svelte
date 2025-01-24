<script lang="ts">
	import '../app.css';
	import Menu from './Menu.svelte';
	let { children } = $props();
</script>

<div class="p-4 md:flex md:h-full md:items-center md:justify-center">
	{@render children()}
</div>
<Menu />
