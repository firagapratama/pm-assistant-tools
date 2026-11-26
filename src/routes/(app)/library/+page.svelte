<script lang="ts">
	// Library fitur (PRD F3): template fitur umum dengan effort default per peran (jam).
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { BookOpen, ChevronDown, Plus, Search, Trash2 } from '@lucide/svelte';
	import NumInput from '#lib/components/NumInput.svelte';
	import { toast } from '#lib/components/toast.svelte.ts';
	import { pertE } from '#lib/calc/pert.ts';
	import type { ThreePointMap } from '#lib/change-request.ts';
	import { decimal } from '#lib/format/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const CATEGORIES = ['Auth', 'CRUD', 'Pembayaran', 'Notifikasi', 'Laporan', 'Integrasi', 'Lainnya'];
	const COMPLEXITY = { rendah: 'Rendah', sedang: 'Sedang', tinggi: 'Tinggi' } as const;
	type Complexity = keyof typeof COMPLEXITY;
	type Template = (typeof data.templates)[number];

	let query = $state('');
	let rows = $derived(
		data.templates.filter((t) => {
			const q = query.trim().toLowerCase();
			return !q || `${t.name} ${t.category} ${t.description}`.toLowerCase().includes(q);
		})
	);
	let categories = $derived([...new Set(rows.map((t) => t.category))]);
	let allCategories = $derived([...new Set([...CATEGORIES, ...data.templates.map((t) => t.category)])]);

	const roleName = (id: number) => data.roles.find((r) => r.id === id)?.label ?? `Peran #${id}`;
	const totalE = (e: ThreePointMap) => Object.values(e).reduce((a, t) => a + pertE(t), 0);

	let editing: number | 'baru' | null = $state(null);
	let saving = $state(false);
	const empty = () => ({ name: '', category: '', complexity: 'sedang' as Complexity, description: '', assumptions: '', efforts: {} as ThreePointMap });
	let form = $state(empty());

	function startEdit(t: Template | null) {
		editing = t ? t.id : 'baru';
		form = t
			? { name: t.name, category: t.category, complexity: t.complexity, description: t.description, assumptions: t.assumptions, efforts: structuredClone($state.snapshot(t.efforts)) }
			: empty();
	}

	function setEffort(roleId: number, k: 'o' | 'm' | 'p', hours: number) {
		const t = { ...(form.efforts[roleId] ?? { o: 0, m: 0, p: 0 }), [k]: hours };
		// Mengisi M lebih dulu langsung menjadi O = M = P; O/P bisa diperlebar setelahnya.
		if (k === 'm' && !form.efforts[roleId]) Object.assign(t, { o: hours, p: hours });
		form.efforts = { ...form.efforts, [roleId]: t };
	}

	async function post(action: string, fields: Record<string, string | number>) {
		const body = new FormData();
		for (const [k, v] of Object.entries(fields)) body.set(k, String(v));
		const res = await fetch(`?/${action}`, { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
		const result = deserialize(await res.text());
		await invalidateAll();
		if (result.type === 'success') {
			if (typeof result.data?.message === 'string') toast(result.data.message);
			return result.data ?? {};
		}
		toast(result.type === 'failure' ? String(result.data?.message ?? 'Gagal menyimpan.') : 'Terjadi kesalahan. Muat ulang halaman.', 'error');
		return null;
	}

	async function save() {
		saving = true;
		const res = await post('save', { ...(typeof editing === 'number' ? { id: editing } : {}), ...form, efforts: JSON.stringify(form.efforts) });
		saving = false;
		if (res) editing = null;
	}

	async function remove(t: Template) {
		if (!confirm(`Hapus template "${t.name}"? Estimasi yang sudah memakainya tidak berubah.`)) return;
		saving = true;
		if (await post('delete', { id: t.id })) editing = null;
		saving = false;
	}
</script>

<svelte:head><title>Library fitur · PM Workspace</title></svelte:head>

<header class="halaman-kepala">
	<div>
		<h1>Library fitur</h1>
		<p>Template fitur umum dengan effort default. Ditambahkan ke estimasi dengan cara disalin.</p>
	</div>
	<button class="btn primer" onclick={() => startEdit(null)}><Plus size={16} strokeWidth={2} aria-hidden="true" /> Tambah template</button>
</header>

{#snippet editor()}
	<div class="form-tpl">
		<div class="kolom">
			<label class="field">
				<span class="field-label">Nama fitur</span>
				<!-- svelte-ignore a11y_autofocus -->
				<input bind:value={form.name} maxlength="160" autofocus placeholder="Contoh: Login & reset password" />
			</label>
			<label class="field">
				<span class="field-label">Kategori</span>
				<input bind:value={form.category} maxlength="80" list="kategori" placeholder="Auth, Pembayaran, …" />
			</label>
			<label class="field">
				<span class="field-label">Kompleksitas</span>
				<select bind:value={form.complexity}>
					{#each Object.entries(COMPLEXITY) as [k, v] (k)}<option value={k}>{v}</option>{/each}
				</select>
			</label>
		</div>
		<div class="kolom dua">
			<label class="field">
				<span class="field-label">Deskripsi <span class="opsional">· opsional</span></span>
				<textarea rows="2" bind:value={form.description} maxlength="2000"></textarea>
			</label>
			<label class="field">
				<span class="field-label">Catatan asumsi <span class="opsional">· opsional</span></span>
				<textarea rows="2" bind:value={form.assumptions} maxlength="2000"></textarea>
			</label>
		</div>
		<fieldset class="field">
			<legend class="field-label">Effort default per peran (jam) — optimis / paling mungkin / pesimis</legend>
			<div class="effort">
				{#each data.roles as r (r.id)}
					{@const e = form.efforts[r.id] ?? { o: 0, m: 0, p: 0 }}
					<span class="peran">{r.label}{r.active ? '' : ' (nonaktif)'}</span>
					{#each ['o', 'm', 'p'] as const as k (k)}
						<NumInput
							value={e[k]}
							onchange={(v) => setEffort(r.id, k, v ?? 0)}
							digits={1}
							suffix="jam"
							label="{r.label} {k === 'o' ? 'optimis' : k === 'm' ? 'paling mungkin' : 'pesimis'}"
						/>
					{/each}
				{/each}
			</div>
			{#if data.roles.length === 0}<p class="field-hint">Belum ada peran. Tambahkan di <a href="/pengaturan">Pengaturan</a>.</p>{/if}
		</fieldset>
		<div class="aksi">
			{#if typeof editing === 'number'}
				{@const t = data.templates.find((x) => x.id === editing)!}
				<button class="btn kecil bahaya" onclick={() => remove(t)} disabled={saving}><Trash2 size={14} strokeWidth={1.75} aria-hidden="true" /> Hapus</button>
			{/if}
			<span class="ruang"></span>
			<span class="redup kecil">Total E: {decimal(totalE(form.efforts), 1)} jam</span>
			<button class="btn teks" onclick={() => (editing = null)} disabled={saving}>Batal</button>
			<button class="btn" onclick={save} disabled={saving || !form.name.trim()}>{saving ? 'Menyimpan…' : 'Simpan'}</button>
		</div>
	</div>
{/snippet}

<datalist id="kategori">{#each allCategories as c (c)}<option value={c}></option>{/each}</datalist>

{#if editing === 'baru'}
	<div class="panel baru">{@render editor()}</div>
{/if}

{#if data.templates.length === 0 && editing !== 'baru'}
	<div class="kosong-blok">
		<BookOpen size={20} strokeWidth={1.5} aria-hidden="true" />
		<strong>Belum ada template fitur</strong>
		<p>Tambahkan fitur umum seperti login atau payment gateway, atau simpan fitur dari estimasi ke library.</p>
	</div>
{:else if data.templates.length}
	<label class="cari">
		<Search size={16} strokeWidth={1.75} aria-hidden="true" />
		<input type="search" bind:value={query} placeholder="Cari nama, kategori, deskripsi" aria-label="Cari template" />
	</label>

	{#each categories as cat (cat)}
		<section class="kelompok" aria-labelledby="kat-{cat}">
			<h2 id="kat-{cat}">{cat} <span class="redup">{rows.filter((t) => t.category === cat).length}</span></h2>
			<div class="tabel-wadah">
				<table>
					<thead>
						<tr>
							<th>Fitur</th>
							<th>Kompleksitas</th>
							<th>Effort per peran (E)</th>
							<th class="angka">Total E</th>
							<th><span class="sr-only">Ubah</span></th>
						</tr>
					</thead>
					<tbody>
						{#each rows.filter((t) => t.category === cat) as t (t.id)}
							<tr class="baris">
								<td class="desk">
									<button class="buka" aria-expanded={editing === t.id} onclick={() => (editing === t.id ? (editing = null) : startEdit(t))}>{t.name}</button>
									{#if t.description}<span class="sub">{t.description}</span>{/if}
								</td>
								<td class="kecil">{COMPLEXITY[t.complexity]}</td>
								<td class="kecil redup">
									{Object.entries(t.efforts).map(([id, e]) => `${roleName(Number(id))} ${decimal(pertE(e), 1)}`).join(' · ') || '–'}
								</td>
								<td class="angka nowrap">{decimal(totalE(t.efforts), 1)} jam</td>
								<td class="chev"><span class:putar={editing === t.id}><ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" /></span></td>
							</tr>
							{#if editing === t.id}
								<tr class="panel-ubah"><td colspan="5">{@render editor()}</td></tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{:else}
		<p class="redup">Tidak ada template yang cocok dengan "{query}".</p>
	{/each}
{/if}

<style>
	.baru {
		margin-bottom: var(--jarak-6);
	}
	.cari {
		display: flex;
		align-items: center;
		gap: var(--jarak-2);
		max-width: 360px;
		margin-bottom: var(--jarak-6);
		color: var(--tinta-2);
	}
	.kelompok {
		margin-bottom: var(--jarak-8);
	}
	/* Lebar kolom sama di semua kategori agar tabel sejajar. */
	.kelompok table {
		table-layout: fixed;
	}
	.kelompok th:nth-child(1) {
		width: 36%;
	}
	.kelompok th:nth-child(2) {
		width: 14%;
	}
	.kelompok th:nth-child(4) {
		width: 12%;
	}
	.kelompok th:nth-child(5) {
		width: 48px;
	}
	.kelompok h2 {
		margin-bottom: var(--jarak-3);
		font-size: var(--teks-h3);
	}
	.form-tpl {
		display: grid;
		gap: var(--jarak-4);
		padding: var(--jarak-6);
	}
	.kolom {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 220px 160px;
		gap: var(--jarak-4);
	}
	.kolom.dua {
		grid-template-columns: 1fr 1fr;
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}
	.effort {
		display: grid;
		grid-template-columns: minmax(140px, max-content) repeat(3, 130px);
		gap: var(--jarak-2);
		align-items: center;
		margin-top: var(--jarak-2);
	}
	.peran {
		padding-right: var(--jarak-4);
	}
	.aksi {
		display: flex;
		align-items: center;
		gap: var(--jarak-2);
	}
	.ruang {
		flex: 1;
	}
	.buka {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-weight: 500;
		color: var(--tinta);
		text-align: left;
		cursor: pointer;
	}
	.buka:hover {
		color: var(--nila);
	}
	.sub {
		display: block;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.chev span {
		display: inline-flex;
		transition: transform 0.15s;
	}
	.chev .putar {
		transform: rotate(180deg);
	}
	.nowrap {
		white-space: nowrap;
	}
	.kecil {
		font-size: var(--teks-kecil);
	}
	.redup {
		color: var(--tinta-2);
	}
	@media (max-width: 900px) {
		.kolom,
		.kolom.dua {
			grid-template-columns: 1fr;
		}
		.effort {
			grid-template-columns: 1fr repeat(3, 90px);
		}
	}
</style>
