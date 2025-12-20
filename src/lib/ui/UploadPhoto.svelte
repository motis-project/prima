<script lang="ts">
	import { t } from '$lib/i18n/translation';
	import { Button } from '$lib/shadcn/button';
	let {
		currentUrl,
		maxSizeMB,
		allowedTypes,
		name,
		displaySaveButton,
		defaultPicture,
		loading = $bindable(),
		uploaded = $bindable()
	}: {
		currentUrl?: string;
		maxSizeMB?: number;
		allowedTypes?: string[];
		name: string;
		defaultPicture: string;
		displaySaveButton?: boolean;
		loading?: boolean;
		uploaded?: boolean;
	} = $props();

	let selectedFile: File | null = $state(null);
	const pictureClass = 'h-32 w-32 overflow-hidden border border-gray-200';

	function handleFileChange(e: Event) {
		uploaded = false;
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
	<div class="mb-4">
		<p class="text-sm">{t.rideShare.preview}</p>
		<div class={pictureClass}>
			<img
				src={URL.createObjectURL(selectedFile)}
				alt="Preview"
				class="h-full w-full object-cover"
			/>
		</div>
	</div>
{:else if currentUrl}
	<div class="mb-4">
		<img src={currentUrl} alt={currentUrl} class={pictureClass} />
	</div>
{:else}
	<div class="mb-4">
		<img src={defaultPicture} alt={currentUrl} class={pictureClass} />
	</div>
{/if}

<div class="flex items-center justify-start gap-1">
	<label for={name}>
		<Button type="button" variant="outline" onclick={() => document.getElementById(name)?.click()}>
			{t.buttons.uploadPhoto}
		</Button>
	</label>
	{#if displaySaveButton && selectedFile}
		<Button type="submit" variant="default" disabled={loading || uploaded}
			>{uploaded ? t.buttons.photoSaved : t.buttons.savePhoto}</Button
		>
	{/if}
</div>
