<script lang="ts">
	import { t } from '$lib/i18n/translation';

	const {
		passengers,
		wheelchair,
		price,
		luggage
	}: {
		passengers: number;
		wheelchair: boolean;
		price: number;
		luggage: number;
	} = $props();
</script>

<div class="mb-2">{t.booking.summary}:</div>
<ul class="flex list-inside list-disc flex-col gap-2">
	<li>
		{t.booking.totalPrice}:
		<span class="font-bold">{price} €</span>
	</li>

	<li>{t.booking.bookingFor(passengers)}</li>

	{#if wheelchair}
		<li>{t.booking.withFoldableWheelchair}</li>
	{/if}

	{#if luggage == 0}
		<li>{t.booking.noLuggage}</li>
	{:else if luggage == 1}
		<li>{t.booking.handLuggage}</li>
	{:else if luggage == 3}
		<li>{t.booking.heavyLuggage}</li>
	{/if}
</ul>
