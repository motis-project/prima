<script lang="ts">
	import Footer from '$lib/ui/Footer.svelte';
</script>

<div class="fine-print mx-auto max-w-[800px]">
	<h1>Lizenzen</h1>

	<ul>
		<li>
			<a
				href="https://www.opendata-oepnv.de/ht/de/organisation/delfi/startseite?tx_vrrkit_view%5Bdataset_name%5D=deutschlandweite-sollfahrplandaten-gtfs&tx_vrrkit_view%5Baction%5D=details&tx_vrrkit_view%5Bcontroller%5D=View"
				class="border-b border-dotted">CC BY 4.0 DELFI Sollfahrplan</a
			>
		</li>
		<li>
			<a class="border-b border-dotted" href="https://zhv.wvigmbh.de"
				>CC BY 4.0 DELFI ZHV Haltestellendaten</a
			>
		</li>
		<li>
			CC BY 4.0 DB InfraGO <a
				class="border-b border-dotted"
				href="https://developers.deutschebahn.com/db-api-marketplace/apis/product/ris-stations"
				>RIS::Stations</a
			>
		</li>
		<li>
			<a class="border-b border-dotted" href="https://www.openstreetmap.org/copyright"
				>OpenStreetMap Contributors</a
			>
		</li>
		<li>ZVON/VVO RT-Daten</li>
	</ul>

	<Footer />
</div>
