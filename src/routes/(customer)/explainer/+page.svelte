<script lang="ts">
	import { Button } from '$lib/shadcn/button';
	import { ChevronLeft } from 'lucide-svelte';
	import { t } from '$lib/i18n/translation';
	import venn1 from '$lib/assets/venn1.png';
	import venn2 from '$lib/assets/venn2.png';
	import venn3 from '$lib/assets/venn3.png';
</script>

<div class="md:min-h-[70dvh] md:w-96">
	<div class="contents">
		<Button variant="outline" size="icon" onclick={() => window.history.back()}>
				<ChevronLeft />
			</Button>
		<div class="flex items-center text-center h-full flex-col gap-4">
			<p>{t.explainer.p1}</p>
			<img class="w-1/2" src={venn1} alt="{t.explainer.alt1}"/>
			<p>{t.explainer.p2}</p>
			<img class="w-3/4" src={venn2} alt="{t.explainer.alt2}"/>
			<p>{t.explainer.p3}</p>
			<img class="w-1/2" src={venn3} alt="{t.explainer.alt3}"/>
			<p>{t.explainer.p4}</p>
		</div>
	</div>
</div>
