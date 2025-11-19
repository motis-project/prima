<script lang="ts">
	import { goto } from '$app/navigation';

	import { Button } from '$lib/shadcn/button';
	import { Textarea } from '$lib/shadcn/textarea';
	import * as Select from '$lib/shadcn/select';

	import { t } from '$lib/i18n/translation';
	import ConnectionDetail from '../../routing/ConnectionDetail.svelte';

	import { enhance } from '$app/forms';
	import { Label } from '$lib/shadcn/label';
	import Message from '$lib/ui/Message.svelte';

	const { data, form } = $props();
	const reasons = ['tourism', 'commute', 'education', 'errands', 'leisure'];
	let reason: string | undefined = $state();
</script>

<div class="flex h-full flex-col gap-4 md:min-h-[70dvh] md:w-96">
	<h3 class="text-xl">{t.rating.howHasItBeen}</h3>
	{#if form?.msg}
		<Message msg={form.msg} class="mb-4" />
		<a href="/" class="link">{t.rating.backToHome}</a>
	{:else if !data.rated}
		<form class="my-4 flex flex-col gap-4" method="post" use:enhance>
			<Select.Root type="single" bind:value={reason} required={true} name="reason">
				<Select.Trigger class="overflow-hidden" aria-label={t.rating.reason}>
					{reason ? (t.rating as { [key: string]: string })[reason] : t.rating.reason}
				</Select.Trigger>
				<Select.Content>
					{#each reasons as r}
						<Select.Item value={r} label={(t.rating as { [key: string]: string })[r]}>
							{(t.rating as { [key: string]: string })[r]}
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<div class="grid grid-cols-[auto_max-content_max-content] gap-x-3 gap-y-3">
				<span>{t.rating.howHasBookingBeen}</span>
				<label class="flex-shrink-0">
					<input type="radio" name="ratingBooking" value="good" required />
					{t.rating.good}
				</label>
				<label class="flex-shrink-0">
					<input type="radio" name="ratingBooking" value="bad" required />
					{t.rating.bad}
				</label>
				<span>{t.rating.howHasJourneyBeen}</span>
				<label>
					<input type="radio" name="ratingJourney" value="good" required />
					{t.rating.good}
				</label>
				<label>
					<input type="radio" name="ratingJourney" value="bad" required />
					{t.rating.bad}
				</label>
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
