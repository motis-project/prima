<script lang="ts">
	import { PUBLIC_PROVIDER, PUBLIC_PRIVACY_URL, PUBLIC_IMPRINT_URL } from '$env/static/public';
	import Meta from '$lib/ui/Meta.svelte';
	import { Button } from '$lib/shadcn/button';
	import { ChevronLeft } from 'lucide-svelte';
	import { t } from '$lib/i18n/translation';
	import venn1 from '$lib/assets/venn1.png';
	import venn2 from '$lib/assets/venn2.png';
	import venn3 from '$lib/assets/venn3.png';
	import logo from '$lib/assets/logo-alpha.png';
</script>

<Meta title="{t.explainer.title} | {PUBLIC_PROVIDER}" />

<div class="md:min-h-[70dvh] md:w-96">
	<div class="contents">
		<div class="flex h-full flex-col items-center gap-4 text-center">
			<strong>PriMa+ÖV</strong>
			<img class="w-1/2" src={logo} alt={t.logo} />
			<p>{t.explainer.p1}</p>
			<img class="w-1/2" src={venn1} alt={t.explainer.alt1} />
			<p>{t.explainer.p2}</p>
			<img class="w-3/4" src={venn2} alt={t.explainer.alt2} />
			<p>{t.explainer.p3}</p>
			<img class="w-1/2" src={venn3} alt={t.explainer.alt3} />
			<p>{t.explainer.p4}</p>

			<Button variant="outline" size="lg" onclick={() => window.history.back()}>
				{t.toConnectionSearch}
			</Button>
		</div>
		<p class="mx-auto mt-6 max-w-72 text-center text-xs text-input">
			<a
				href={PUBLIC_IMPRINT_URL}
				target="_blank"
				class="whitespace-nowrap border-b border-dotted border-input">{t.account.imprint}</a
			>
			|
			<a href={PUBLIC_PRIVACY_URL} class="whitespace-nowrap border-b border-dotted border-input"
				>{t.account.privacy_short}</a
			>
		</p>
	</div>
</div>
