<script lang="ts">
	import { Star } from 'lucide-svelte';
	import { Button } from '$lib/shadcn/button';
	import ConnectionDetail from '../../routing/ConnectionDetail.svelte';
	import { goto } from '$app/navigation';
	import { t } from '$lib/i18n/translation';
	import { Label } from '$lib/shadcn/label';
	import Message from '$lib/ui/Message.svelte';

	const { data, form } = $props();

	let rating = $state(0);
	let hover = $state(0);
	let feedbackGiven = $state(false);

	const setRating = (value: number) => {
		rating = value;
		feedbackGiven = true;
	};
</script>

<div class="flex h-full flex-col gap-4 md:min-h-[70dvh] md:w-96">
	{#if form?.msg}
		<Message msg={form.msg} class="mb-4" />
	{:else}
		<form method="post" class="flex flex-col gap-4">
			<Label
				>{(data.isCustomer ? t.rideShare.feedbackPrompt : t.rideShare.feedbackPromptProvider) +
					` ${data.firstName || data.name}`}</Label
			>
			<div class="flex gap-1">
				{#each Array(5) as _, idx}
					<Star
						data-testid={`star-${idx + 1}`}
						fill={(hover || rating) > idx ? 'gold' : ''}
						size={24}
						color="gold"
						onclick={() => setRating(idx + 1)}
						onmouseover={() => (hover = idx + 1)}
						onmouseout={() => (hover = 0)}
						class="cursor-pointer transition-colors"
					/>
				{/each}
			</div>

			<input type="hidden" name="rating" value={rating} />
			<input type="hidden" name="id" value={data.id} />
			<input type="hidden" name="given" value={feedbackGiven} />
			<input type="hidden" name="isCustomer" value={data.isCustomer} />

			<Button type="submit">{t.rating.sendFeedback}</Button>
		</form>

		<ConnectionDetail
			itinerary={data.journey}
			onClickStop={(_name: string, stopId: string, time: Date) =>
				goto(`/routing?stopId=${stopId}&time=${time.getTime()}`)}
			onClickTrip={(tripId: string) => goto(`/routing?tripId=${tripId}`)}
		/>
	{/if}
</div>
