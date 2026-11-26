<script lang="ts">
	// Menambahkan beberapa fitur dari library sekaligus (PRD F3). Nilai disalin: library dan estimasi tidak saling memengaruhi.
	import { BookOpen, Search, X } from '@lucide/svelte';
	import { pertE } from '#lib/calc/pert.ts';
	import type { ThreePointMap } from '#lib/change-request.ts';
	import { toast } from '#lib/components/toast.svelte.ts';
	import { decimal } from '#lib/format/index.ts';
	import type { DraftFeature } from '#lib/validation/estimate.ts';
	import type { EstimateEditor } from './editor.svelte.ts';

	interface Template {
		id: number;
		name: string;
		category: string;
		complexity: 'rendah' | 'sedang' | 'tinggi';
		description: string;
		assumptions: string;
		efforts: ThreePointMap;
	}

	let { ed, library, onclose }: { ed: EstimateEditor; library: Template[]; onclose: () => void } = $props();

	const COMPLEXITY = { rendah: 'Rendah', sedang: 'Sedang', tinggi: 'Tinggi' } as const;
	let query = $state('');
	let picked: number[] = $state([]);
	let rows = $derived(
		library.filter((t) => {
			const q = query.trim().toLowerCase();
			return !q || `${t.name} ${t.category} ${t.description}`.toLowerCase().includes(q);
		})
	);
	let categories = $derived([...new Set(rows.map((t) => t.category))]);
	let known = $derived(new Set(ed.rates.map((r) => r.roleId)));
	const totalE = (e: ThreePointMap) => Object.values(e).reduce((a, t) => a + pertE(t), 0);

	function add() {
		let dropped = 0;
		const features: DraftFeature[] = library
			.filter((t) => picked.includes(t.id))
			.map((t) => {
				const efforts: ThreePointMap = {};
				for (const [id, e] of Object.entries(t.efforts)) {
					if (known.has(Number(id))) efforts[Number(id)] = { ...e };
					else dropped++;
				}
				return { module: t.category, name: t.name, description: t.description, priority: 'must', assumptions: t.assumptions, efforts };
			});
		const undo = ed.applyDraft(features, 'append');
		toast(
			`${features.length} fitur ditambahkan dari library${dropped ? `; ${dropped} effort dilewati karena perannya tidak ada di estimasi ini` : ''}`,
			'info',
			{ label: 'Urungkan', run: undo }
		);
		onclose();
	}
</script>

<section class="panel pilih" aria-labelledby="judul-library">
	<div class="kepala">
		<h2 id="judul-library"><BookOpen size={16} strokeWidth={1.75} aria-hidden="true" /> Tambah dari library</h2>
		<button class="btn teks kecil" onclick={onclose} aria-label="Tutup"><X size={16} strokeWidth={1.75} aria-hidden="true" /></button>
	</div>
	{#if library.length === 0}
		<p class="redup">Library masih kosong. Tambahkan template di <a href="/library">Library</a>, atau simpan fitur dari estimasi ini ke library.</p>
	{:else}
		<label class="cari">
			<Search size={16} strokeWidth={1.75} aria-hidden="true" />
			<input type="search" bind:value={query} placeholder="Cari fitur" aria-label="Cari template" />
		</label>
		<div class="daftar">
			{#each categories as cat (cat)}
				<fieldset>
					<legend>{cat}</legend>
					{#each rows.filter((t) => t.category === cat) as t (t.id)}
						<label class="opsi">
							<input type="checkbox" value={t.id} bind:group={picked} />
							<span>
								<strong>{t.name}</strong>
								<span class="sub">{COMPLEXITY[t.complexity]} · {decimal(ed.toUnit(totalE(t.efforts)), 1)} {ed.unitLabel}{t.description ? ` · ${t.description}` : ''}</span>
							</span>
						</label>
					{/each}
				</fieldset>
			{:else}
				<p class="redup">Tidak ada yang cocok dengan "{query}".</p>
			{/each}
		</div>
		<div class="aksi">
			<span class="redup kecil">Nilai disalin ke estimasi; mengubahnya tidak mengubah library.</span>
			<span class="ruang"></span>
			<button class="btn teks" onclick={onclose}>Batal</button>
			<button class="btn primer" onclick={add} disabled={!picked.length}>Tambahkan {picked.length || ''} fitur</button>
		</div>
	{/if}
</section>

<style>
	.pilih {
		display: grid;
		gap: var(--jarak-4);
		padding: var(--jarak-6);
		margin-bottom: var(--jarak-6);
	}
	.kepala {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.kepala h2 {
		display: inline-flex;
		align-items: center;
		gap: var(--jarak-2);
		margin: 0;
		font-size: var(--teks-isi);
	}
	.cari {
		display: flex;
		align-items: center;
		gap: var(--jarak-2);
		max-width: 360px;
		color: var(--tinta-2);
	}
	.daftar {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: var(--jarak-4) var(--jarak-6);
		max-height: 420px;
		overflow: auto;
	}
	fieldset {
		display: grid;
		gap: var(--jarak-2);
		align-content: start;
		margin: 0;
		padding: 0;
		border: 0;
	}
	legend {
		margin-bottom: var(--jarak-2);
		font-size: var(--teks-kecil);
		font-weight: 600;
		color: var(--tinta-2);
	}
	.opsi {
		display: flex;
		gap: var(--jarak-2);
		align-items: flex-start;
		cursor: pointer;
	}
	.opsi input {
		margin-top: 4px;
	}
	.opsi strong {
		font-weight: 500;
	}
	.sub {
		display: block;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.aksi {
		display: flex;
		align-items: center;
		gap: var(--jarak-2);
	}
	.ruang {
		flex: 1;
	}
	.kecil {
		font-size: var(--teks-kecil);
	}
	.redup {
		color: var(--tinta-2);
	}
</style>
