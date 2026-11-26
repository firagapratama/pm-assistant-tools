<script lang="ts">
	import { tick } from 'svelte';
	import { ArrowDown, ArrowUp, ChevronDown, Copy, ListPlus, Plus, Trash2, TriangleAlert, X } from '@lucide/svelte';
	import { pertE, pertSigma, type Priority } from '#lib/calc/pert.ts';
	import NumInput from '#lib/components/NumInput.svelte';
	import RangeBand from '#lib/components/RangeBand.svelte';
	import { toast } from '#lib/components/toast.svelte.ts';
	import { decimal } from '#lib/format/index.ts';
	import { deserialize } from '$app/forms';
	import { BookOpen, BookmarkPlus } from '@lucide/svelte';
	import AiDraft from './AiDraft.svelte';
	import LibraryPicker from './LibraryPicker.svelte';
	import type { EditorFeature, EstimateEditor } from './editor.svelte.ts';

	let {
		ed,
		ai,
		needs,
		prospectId,
		library
	}: {
		ed: EstimateEditor;
		ai: { model: string } | null;
		needs: string;
		prospectId: number;
		library: import('#lib/server/library.ts').FeatureTemplate[];
	} = $props();

	let picking = $state(false);
	let savingLib: number | null = $state(null);

	async function saveToLibrary(f: EditorFeature) {
		if (!f.name.trim()) return toast('Beri nama fitur dulu sebelum menyimpan ke library.', 'error');
		savingLib = f.key;
		const { key: _key, ...feature } = $state.snapshot(f);
		const body = new FormData();
		body.set('payload', JSON.stringify(feature));
		const res = deserialize(await (await fetch('?/saveToLibrary', { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } })).text());
		savingLib = null;
		if (res.type === 'success') toast(String(res.data?.message ?? 'Disimpan ke library'));
		else toast(res.type === 'failure' ? String(res.data?.message ?? 'Gagal menyimpan.') : 'Terjadi kesalahan.', 'error');
	}

	let open: number | null = $state(null);

	const PRIORITIES: { value: Priority; label: string }[] = [
		{ value: 'must', label: 'Must' },
		{ value: 'should', label: 'Should' },
		{ value: 'could', label: 'Could' }
	];

	/** Total satu fitur dari seluruh peran (jam). */
	function totals(f: EditorFeature) {
		let o = 0, p = 0, e = 0, variance = 0;
		for (const t of Object.values(f.efforts)) {
			o += t.o;
			p += t.p;
			e += pertE(t);
			variance += pertSigma(t) ** 2;
		}
		return { o, p, e, sigma: Math.sqrt(variance) };
	}

	let maxP = $derived(Math.max(1, ...ed.features.map((f) => totals(f).p)));
	let addable = $derived(ed.rates.filter((r) => !ed.columns.includes(r.roleId)));
	let colCount = $derived(ed.columns.length + 5);
	const fmt = (hours: number) => (hours > 0 ? decimal(ed.toUnit(hours), 1) : '–');

	async function focusName(key: number) {
		open = key;
		await tick();
		document.getElementById(`nama-${key}`)?.focus();
	}

	function add() {
		focusName(ed.addFeature(ed.features.at(-1)?.module ?? ''));
	}

	function removeFeature(f: EditorFeature) {
		const undo = ed.remove(f.key);
		open = null;
		toast(`Fitur ${f.name || 'tanpa nama'} dihapus`, 'info', { label: 'Urungkan', run: undo });
	}

	/** Enter berpindah ke isian berikutnya (design.md 6.2). */
	function enterNext(e: KeyboardEvent) {
		if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement)) return;
		e.preventDefault();
		const list = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('.fitur-edit input:not(:disabled)')];
		list[list.indexOf(e.target) + 1]?.focus();
	}
</script>

<datalist id="daftar-modul">
	{#each ed.modules as m (m)}<option value={m}></option>{/each}
</datalist>

{#if !ed.locked}
	<div class="ai-baris">
		<AiDraft {ed} {ai} {needs} {prospectId} />
		<button class="btn" onclick={() => (picking = !picking)} aria-expanded={picking}><BookOpen size={16} strokeWidth={1.75} aria-hidden="true" /> Dari library</button>
	</div>
	{#if picking}<LibraryPicker {ed} {library} onclose={() => (picking = false)} />{/if}
{/if}

{#if ed.features.length === 0}
	<div class="kosong-blok">
		<ListPlus size={20} strokeWidth={1.5} aria-hidden="true" />
		<strong>Belum ada fitur</strong>
		<p>
			Pecah kebutuhan menjadi fitur, lalu isi estimasi optimis, paling mungkin, dan pesimis per peran dalam
			{ed.unit === 'sp' ? 'story point' : 'jam'}.
		</p>
		{#if !ed.locked}<button class="btn" onclick={add}><Plus size={16} strokeWidth={2} aria-hidden="true" /> Tambah fitur pertama</button>{/if}
	</div>
{:else}
	<div class="alat">
		<p class="keterangan">
			Angka di tabel adalah nilai E (PERT) dalam {ed.unit === 'sp' ? 'story point' : 'jam'}. Klik fitur untuk mengisi O / M / P.
		</p>
		{#if !ed.locked && addable.length > 0}
			<label class="tambah-kolom">
				<span class="sr-only">Tambah kolom peran</span>
				<select
					value=""
					onchange={(e) => {
						const id = Number(e.currentTarget.value);
						if (id) ed.addColumn(id);
						e.currentTarget.value = '';
					}}
				>
					<option value="" disabled>+ Kolom peran</option>
					{#each addable as r (r.roleId)}<option value={r.roleId}>{ed.roleName(r.roleId)}</option>{/each}
				</select>
			</label>
		{/if}
	</div>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="tabel-wadah" onkeydown={enterNext}>
		<table class="fitur">
			<thead>
				<tr>
					<th class="modul">Modul</th>
					<th>Fitur</th>
					{#each ed.columns as id (id)}
						<th class="angka peran">
							<span class="peran-isi">
								{ed.roleName(id)}
								{#if !ed.locked && !ed.columnHasEffort(id)}
									<button class="hapus-kolom" aria-label="Sembunyikan kolom {ed.roleName(id)}" onclick={() => ed.removeColumn(id)}>
										<X size={12} strokeWidth={2} />
									</button>
								{/if}
							</span>
						</th>
					{/each}
					<th class="angka">Total</th>
					<th class="pita-kol"><span class="sr-only">Rentang</span></th>
					<th class="chev-kol"><span class="sr-only">Buka</span></th>
				</tr>
			</thead>
			<tbody>
				{#each ed.features as f, i (f.key)}
					{@const t = totals(f)}
					{@const valid = ed.featureValid(f)}
					{@const isOpen = open === f.key}
					<tr class="baris" class:terbuka={isOpen}>
						<td class="modul">{f.module !== ed.features[i - 1]?.module ? f.module : ''}</td>
						<td class="nama">
							<button class="buka" aria-expanded={isOpen} aria-controls="edit-{f.key}" onclick={() => (open = isOpen ? null : f.key)}>
								<span class:tanpa-nama={!f.name}>{f.name || 'Fitur tanpa nama'}</span>
								{#if f.priority !== 'must'}<span class="prioritas">{f.priority === 'should' ? 'Should' : 'Could'}</span>{/if}
								{#if !valid}<span class="peringatan" title="O ≤ M ≤ P belum terpenuhi"><TriangleAlert size={14} strokeWidth={2} aria-label="Ada nilai tidak valid" /></span>{/if}
							</button>
						</td>
						{#each ed.columns as id (id)}
							<td class="angka">{f.efforts[id] ? fmt(pertE(f.efforts[id])) : '–'}</td>
						{/each}
						<td class="angka total">{fmt(t.e)}</td>
						<td class="pita-kol">
							{#if t.p > 0}
								<RangeBand
									size="mini"
									o={t.o}
									lo={Math.max(0, t.e - t.sigma)}
									e={t.e}
									hi={t.e + t.sigma}
									p={t.p}
									max={maxP}
									label="Rentang {fmt(t.o)}–{fmt(t.p)} {ed.unitLabel}, paling mungkin {fmt(t.e)}"
								/>
							{/if}
						</td>
						<td class="chev-kol"><span class="chevron" class:putar={isOpen}><ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" /></span></td>
					</tr>
					{#if isOpen}
						<tr class="panel-ubah" id="edit-{f.key}">
							<td colspan={colCount}>
								<div class="fitur-edit">
									<div class="identitas">
										<label class="field nama-fitur">
											<span class="field-label">Nama fitur</span>
											<input id="nama-{f.key}" bind:value={f.name} disabled={ed.locked} placeholder="Login dengan email" />
										</label>
										<label class="field">
											<span class="field-label">Modul</span>
											<input bind:value={f.module} list="daftar-modul" disabled={ed.locked} placeholder="Autentikasi" />
										</label>
										<div class="field">
											<span class="field-label" id="prio-{f.key}">Prioritas</span>
											<div class="segmen" role="radiogroup" aria-labelledby="prio-{f.key}">
												{#each PRIORITIES as pr (pr.value)}
													<button
														type="button"
														role="radio"
														aria-checked={f.priority === pr.value}
														disabled={ed.locked}
														onclick={() => ed.setPriority(f.key, pr.value)}>{pr.label}</button
													>
												{/each}
											</div>
										</div>
									</div>

									<div class="effort">
										<div class="effort-kepala">
											<span>Peran</span>
											<span>Optimis</span>
											<span>Paling mungkin</span>
											<span>Pesimis</span>
											<span class="kanan">E</span>
											<span class="kanan">σ</span>
										</div>
										{#each ed.columns as id (id)}
											{@const eff = ed.effort(f, id)}
											{@const ok = ed.isValidEffort(eff)}
											<div class="effort-baris" class:tidak-valid={!ok}>
												<span class="peran-nama">{ed.roleName(id)}</span>
												{#each ['o', 'm', 'p'] as const as k (k)}
													<NumInput
														value={eff[k]}
														onchange={(h) => ed.setEffort(f, id, k, h ?? 0)}
														toDisplay={ed.toUnit}
														fromDisplay={ed.fromUnit}
														suffix={ed.unitLabel}
														placeholder="0"
														disabled={ed.locked}
														invalid={!ok}
														label="{k === 'o' ? 'Optimis' : k === 'm' ? 'Paling mungkin' : 'Pesimis'} {ed.roleName(id)}"
													/>
												{/each}
												<span class="kanan angka">{ok && eff.p > 0 ? decimal(ed.toUnit(pertE(eff)), 1) : '–'}</span>
												<span class="kanan angka redup">{ok && eff.p > 0 ? decimal(ed.toUnit(pertSigma(eff)), 1) : '–'}</span>
												{#if !ok}
													<span class="field-error pesan">
														{eff.o > eff.m
															? 'Nilai optimis tidak boleh lebih besar dari paling mungkin.'
															: 'Nilai paling mungkin tidak boleh lebih besar dari pesimis.'}
													</span>
												{/if}
											</div>
										{/each}
										{#if t.p > 0}
											<p class="field-hint total-fitur">Total fitur: {ed.effortText(t.e)} (E), rentang {fmt(t.o)}–{fmt(t.p)} {ed.unitLabel}</p>
										{/if}
									</div>

									<div class="catatan">
										<label class="field">
											<span class="field-label">Deskripsi <span class="opsional">· opsional</span></span>
											<textarea rows="2" bind:value={f.description} disabled={ed.locked}></textarea>
										</label>
										<label class="field">
											<span class="field-label">Asumsi <span class="opsional">· opsional</span></span>
											<textarea rows="2" bind:value={f.assumptions} disabled={ed.locked} placeholder="Misalnya desain sudah tersedia dari klien"></textarea>
										</label>
									</div>

									{#if !ed.locked}
										<div class="aksi">
											<button class="btn kecil" onclick={() => focusName(ed.duplicate(f.key))}><Copy size={14} strokeWidth={1.75} aria-hidden="true" /> Duplikasi</button>
											<button class="btn kecil" onclick={() => saveToLibrary(f)} disabled={savingLib === f.key}><BookmarkPlus size={14} strokeWidth={1.75} aria-hidden="true" /> Simpan ke library</button>
											<button class="btn kecil" onclick={() => ed.move(f.key, -1)} disabled={i === 0}><ArrowUp size={14} strokeWidth={1.75} aria-hidden="true" /> Naik</button>
											<button class="btn kecil" onclick={() => ed.move(f.key, 1)} disabled={i === ed.features.length - 1}><ArrowDown size={14} strokeWidth={1.75} aria-hidden="true" /> Turun</button>
											<button class="btn kecil bahaya" onclick={() => removeFeature(f)}><Trash2 size={14} strokeWidth={1.75} aria-hidden="true" /> Hapus fitur</button>
										</div>
									{/if}
								</div>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
			<tfoot>
				<tr class="total">
					<td colspan="2">Total ({ed.unitLabel})</td>
					{#each ed.columns as id (id)}
						<td class="angka">{fmt(ed.result.effort.get(id)?.e ?? 0)}</td>
					{/each}
					<td class="angka">{fmt(ed.result.totalEffort.e)}</td>
					<td colspan="2" class="redup kecil">{ed.unit === 'sp' ? `≈ ${decimal(ed.result.totalEffort.e, 1)} jam` : ''}</td>
				</tr>
			</tfoot>
		</table>
	</div>

	{#if !ed.locked}
		<div class="bawah">
			<button class="btn" onclick={add}><Plus size={16} strokeWidth={2} aria-hidden="true" /> Tambah fitur</button>
			<span class="field-hint">{ed.features.length} fitur · maksimal 200</span>
		</div>
	{/if}
{/if}

<style>
	.ai-baris {
		display: flex;
		flex-wrap: wrap;
		gap: var(--jarak-2);
		margin-bottom: var(--jarak-4);
	}
	/* Panel draf AI yang terbuka mengambil satu baris penuh. */
	.ai-baris > :global(section) {
		flex-basis: 100%;
	}
	.alat {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--jarak-4);
		margin-bottom: var(--jarak-3);
	}
	.keterangan {
		margin: 0;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.tambah-kolom select {
		width: auto;
		height: 32px;
		font-size: var(--teks-kecil);
	}
	table.fitur th,
	table.fitur td {
		padding: var(--jarak-2) var(--jarak-3);
	}
	.modul {
		width: 120px;
		color: var(--tinta-2);
		font-size: var(--teks-kecil);
	}
	.peran-isi {
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}
	.hapus-kolom {
		display: inline-flex;
		border: 0;
		background: none;
		padding: 2px;
		border-radius: 4px;
		color: var(--tinta-2);
		cursor: pointer;
		opacity: 0;
	}
	th:hover .hapus-kolom,
	.hapus-kolom:focus-visible {
		opacity: 1;
	}
	.hapus-kolom:hover {
		background: var(--nila-tipis);
	}
	.nama {
		min-width: 220px;
	}
	td.angka {
		white-space: nowrap;
	}
	.buka {
		display: inline-flex;
		align-items: center;
		gap: var(--jarak-2);
		width: 100%;
		padding: var(--jarak-1) 0;
		border: 0;
		background: none;
		font: inherit;
		font-weight: 500;
		color: var(--tinta);
		text-align: left;
		cursor: pointer;
	}
	/* Seluruh baris bisa diklik. */
	tr.baris {
		position: relative;
		cursor: pointer;
	}
	.buka::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	.tanpa-nama {
		color: var(--tinta-2);
		font-style: italic;
		font-weight: 400;
	}
	.prioritas {
		padding: 0 6px;
		border: 1px solid var(--garis);
		border-radius: var(--radius-kecil);
		font-size: var(--teks-mini);
		font-weight: 500;
		color: var(--tinta-2);
	}
	.peringatan {
		display: inline-flex;
		color: var(--kritis);
	}
	.total {
		font-weight: 600;
	}
	.pita-kol {
		width: 120px;
		min-width: 80px;
	}
	.chev-kol {
		width: 32px;
		color: var(--tinta-2);
	}
	.chevron {
		display: inline-flex;
		transition: transform var(--transisi);
	}
	.chevron.putar {
		transform: rotate(180deg);
	}
	tr.terbuka td {
		background: color-mix(in srgb, var(--nila-tipis) 50%, transparent);
	}
	tr.panel-ubah:hover {
		background: none;
	}
	tr.panel-ubah > td {
		padding: 0 !important;
		background: color-mix(in srgb, var(--kertas) 55%, var(--permukaan));
		border-bottom: 1px solid var(--garis);
		cursor: default;
	}
	.fitur-edit {
		display: grid;
		gap: var(--jarak-6);
		padding: var(--jarak-6);
	}
	.identitas {
		display: grid;
		grid-template-columns: 2fr 1.2fr auto;
		gap: var(--jarak-4);
		align-items: start;
	}
	.segmen {
		display: inline-flex;
		height: 40px;
		padding: 3px;
		gap: 2px;
		border-radius: var(--radius-kecil);
		background: color-mix(in srgb, var(--kertas), var(--garis) 55%);
	}
	.segmen button {
		padding: 0 var(--jarak-3);
		border: 0;
		border-radius: 4px;
		background: none;
		font: inherit;
		font-size: var(--teks-kecil);
		font-weight: 500;
		color: var(--tinta-2);
		cursor: pointer;
	}
	.segmen button[aria-checked='true'] {
		background: var(--permukaan);
		color: var(--nila);
		box-shadow: 0 1px 2px rgba(28, 34, 48, 0.08);
	}
	.effort {
		display: grid;
		gap: var(--jarak-2);
		padding: var(--jarak-4);
		border: 1px solid var(--garis);
		border-radius: var(--radius-panel);
		background: var(--permukaan);
	}
	.effort-kepala,
	.effort-baris {
		display: grid;
		grid-template-columns: minmax(120px, 1.4fr) repeat(3, minmax(96px, 1fr)) 64px 56px;
		gap: var(--jarak-2) var(--jarak-3);
		align-items: center;
	}
	.effort-kepala {
		font-size: var(--teks-kecil);
		font-weight: 500;
		color: var(--tinta-2);
	}
	.peran-nama {
		font-size: var(--teks-kecil);
		font-weight: 500;
	}
	.kanan {
		text-align: right;
	}
	.redup {
		color: var(--tinta-2);
	}
	.kecil {
		font-size: var(--teks-kecil);
		font-weight: 400;
	}
	.effort-baris .pesan {
		grid-column: 2 / -1;
	}
	.total-fitur {
		margin: var(--jarak-1) 0 0;
	}
	.catatan {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--jarak-4);
	}
	.aksi {
		display: flex;
		gap: var(--jarak-2);
		flex-wrap: wrap;
	}
	.aksi .bahaya {
		margin-left: auto;
	}
	.bawah {
		display: flex;
		align-items: center;
		gap: var(--jarak-4);
		margin-top: var(--jarak-4);
	}
	tfoot td {
		border-bottom: 0;
	}
	@media (max-width: 900px) {
		.identitas,
		.catatan {
			grid-template-columns: 1fr;
		}
	}
</style>
