<script>
	import { goto } from '$app/navigation';
	let showDialog = false;

	function handleConfirm() {
		showDialog = false;
		goto('/taxi?date=2024-07-25');
	}

	function handleCancel() {
		showDialog = false;
	}

	function openDialog() {
		showDialog = true;
	}
</script>

{#if showDialog}
	<div class="dialog">
		<p>Are you sure?</p>
		<button on:click={handleConfirm}>Ok</button>
		<button on:click={handleCancel}>Cancel</button>
	</div>
{/if}

<button on:click={openDialog}>Click me</button>

<style>
	.dialog {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		padding: 20px;
		background: white;
		border: 1px solid #ccc;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
		z-index: 1000;
	}

	button {
		padding: 10px 20px;
		margin: 5px;
		font-size: 16px;
		cursor: pointer;
	}
</style>
