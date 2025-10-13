<script lang="ts">
	import { defaultProfilePicture } from '$lib/constants';
	import { t } from '$lib/i18n/translation';
	import { CigaretteIcon, CigaretteOffIcon, StarIcon } from 'lucide-svelte';
	const {
		isCustomer,
		firstName,
		name,
		profilePicture,
		gender,
		smokingAllowed,
		averageRating
	}: {
		isCustomer: boolean;
		firstName: string;
		name: string;
		profilePicture: string | null;
		gender: string | null;
		smokingAllowed: boolean | undefined;
		averageRating: string | number | null;
	} = $props();
</script>

<div class="flex flex-row gap-4">
	<img
		src={profilePicture || defaultProfilePicture}
		alt="profile"
		class="mt-2 h-20 w-20 overflow-hidden border border-gray-200"
	/>
	<div>
		<span class="text-sm">{isCustomer ? t.ride.requestBy : t.ride.offerBy}</span>
		<h3 class="font-bold">
			{firstName || name}
			{t.account.genderShort(gender || 'n')}
		</h3>
		<div class="flex flex-row items-center gap-1">
			{#if smokingAllowed}
				<CigaretteIcon class="mr-4" />
			{:else if smokingAllowed === false}
				<CigaretteOffIcon class="mr-4" />
			{/if}
			{#if averageRating != null}
				<StarIcon fill="gold" color="gold" />
				{(
					(typeof averageRating === 'number' ? averageRating : parseFloat(averageRating)) + 1
				).toFixed(1)}
			{/if}
		</div>
	</div>
</div>
