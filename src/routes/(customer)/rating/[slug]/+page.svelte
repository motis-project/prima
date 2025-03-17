<script lang="ts">
	import { goto } from '$app/navigation';

	import { Button } from '$lib/shadcn/button';
	import { Textarea } from '$lib/shadcn/textarea';

	import { t } from '$lib/i18n/translation';
	import ConnectionDetail from '../../routing/ConnectionDetail.svelte';

	import { enhance } from '$app/forms';
	import { Label } from '$lib/shadcn/label';
	import Message from '$lib/ui/Message.svelte';

	const { data, form } = $props();
</script>

<div class="flex h-full flex-col gap-4 md:min-h-[70dvh] md:w-96">
	{#if form?.msg}
		<Message msg={form.msg} class="mb-4" />
	{:else if !data.rated}
		<form class="my-4 flex flex-col gap-4" method="post" use:enhance>
			<div class="flex justify-between">
				<span>{t.rating.howHasJourneyBeen}</span>
				<div class="flex gap-4">
					<label>
						<input type="radio" name="rating" value="good" />
						{t.rating.good}
					</label>
					<label>
						<input type="radio" name="rating" value="bad" />
						{t.rating.bad}
					</label>
				</div>
			</div>
			<div class="field">
				<Label for="comment">{t.rating.yourFeedback}</Label>
				<Textarea name="comment" class="h-auto" rows={3} />
			</div>
			<input type="hidden" name="id" value={data.id} />
			<Button type="submit">{t.rating.sendFeedback}</Button>
		</form>
	{/if}

	<ConnectionDetail
		itinerary={data.journey}
		onClickStop={(_name: string, stopId: string, time: Date) =>
			goto(`/routing?stopId=${stopId}&time=${time.getTime()}`)}
		onClickTrip={(tripId: string) => goto(`/routing?tripId=${tripId}`)}
	/>
</div>
