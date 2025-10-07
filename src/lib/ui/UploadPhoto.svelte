<script lang="ts">
	import { t } from '$lib/i18n/translation';
	import { Button } from '$lib/shadcn/button';
	const {
		currentUrl,
		maxSizeMB,
		allowedTypes,
		name,
		displaySaveButton
	}: {
		currentUrl?: string;
		maxSizeMB?: number;
		allowedTypes?: string[];
		name: string;
		displaySaveButton?: boolean;
	} = $props();

	let selectedFile: File | null = $state(null);

	function handleFileChange(e: Event) {
		const target = e.target as HTMLInputElement | null;

		if (target && target.files && target.files.length !== 0) {
			selectedFile = target.files[0];
			if (
				!(allowedTypes ?? ['image/jpeg', 'image/png', 'image/webp']).includes(selectedFile.type)
			) {
				alert('Invalid file type. Please upload a JPEG, PNG, or WebP image.');
				return;
			}
			if (selectedFile.size > (maxSizeMB ?? 5) * 1024 * 1024) {
				alert(`File too large. Max size is ${maxSizeMB ?? 5}MB.`);
				return;
			}
		}
	}
</script>

<input id={name} {name} type="file" accept="image/*" class="hidden" onchange={handleFileChange} />
{#if selectedFile}
	<div class="mt-4">
		<p class="text-sm">Preview:</p>
		<img
			src={URL.createObjectURL(selectedFile)}
			alt="Preview"
			class="h-full w-full rounded-full object-cover"
		/>
	</div>
{:else if currentUrl}
	<div class="mb-4">
		<img src={currentUrl} alt={currentUrl} class="h-full w-full rounded-full object-cover" />
	</div>
{/if}

<div class="flex items-center justify-between">
	<label for={name}>
		<Button type="button" variant="outline" onclick={() => document.getElementById(name)?.click()}>
			{t.buttons.uploadPhoto}
		</Button>
	</label>
	{#if displaySaveButton && selectedFile}
		<Button type="submit" variant="default">{t.buttons.savePhoto}</Button>
	{/if}
</div>
