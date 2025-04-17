<script lang="ts">
	const { code }: { code: string } = $props();
</script>

<div style="width: 100%;">
	<div
		style="border: 1px solid #d1d5db; padding: 12px 24px; display: inline-block; margin-left: 20px;"
	>
		<p style="margin: 0; font-family: monospace; font-weight: 300;">
			{code}
		</p>
	</div>
</div>
