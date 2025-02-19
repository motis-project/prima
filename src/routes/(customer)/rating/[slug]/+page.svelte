<script lang="ts">
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';
	import Waypoints from 'lucide-svelte/icons/waypoints';
	import QrCodeIcon from 'lucide-svelte/icons/qr-code';

	import { goto } from '$app/navigation';

	import { Button } from '$lib/shadcn/button';
	import * as RadioGroup from '$lib/shadcn/radio-group';
	import { Textarea } from '$lib/shadcn/textarea';

	import { t } from '$lib/i18n/translation';
	import ConnectionDetail from '../../routing/ConnectionDetail.svelte';

	import { enhance } from '$app/forms';
	import { Label } from '$lib/shadcn/label';

	const { data } = $props();
</script>

<div class="flex h-full flex-col gap-4 md:h-[80%] md:w-96">
	<form method="post" use:enhance>
		<RadioGroup.Root class="flex" name="rating">
			<Label
				for="good"
				class="flex items-center rounded-md border-2 border-muted bg-popover p-1 px-2 hover:cursor-pointer hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-blue-600"
			>
				<RadioGroup.Item value="good" id="good" class="sr-only" aria-label={t.rating.good} />
				<span>{t.rating.good}</span>
			</Label>
			<Label
				for="bad"
				class="flex items-center rounded-md border-2 border-muted bg-popover p-1 px-2 hover:cursor-pointer hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-blue-600"
			>
				<RadioGroup.Item value="bad" id="bad" class="sr-only" aria-label={t.rating.bad} />
				<span>{t.rating.bad}</span>
			</Label>
		</RadioGroup.Root>
		<Textarea name="comment" />
		<Button type="submit">Feedback abschicken</Button>
	</form>

	<ConnectionDetail
		itinerary={data.journey}
		onClickStop={(_name: string, stopId: string, time: Date) =>
			goto(`/routing?stopId=${stopId}&time=${time.getTime()}`)}
		onClickTrip={(tripId: string) => goto(`/routing?tripId=${tripId}`)}
	/>
</div>
