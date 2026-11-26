<script lang="ts">
	import { page } from '$app/state';
	import { Inbox, LayoutGrid, List, Plus, Search } from '@lucide/svelte';
	import { date, daysAgo, rupiahShort } from '#lib/format/index.ts';
	import { PROSPECT_STATUSES, STATUS_LABEL, type ProspectStatus } from '#lib/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Kanban menampilkan alur aktif; prospek Batal dilihat lewat filter status di tampilan daftar.
	const KANBAN: ProspectStatus[] = ['prospek', 'estimasi', 'proposal', 'negosiasi', 'deal'];

	let empty = $derived(data.prospects.length === 0);
	let noneAtAll = $derived(empty && data.hasAny !== true);
	let filtered = $derived(Boolean(data.filter.q || data.filter.status || data.filter.client));

	function viewHref(view: 'daftar' | 'kanban') {
		const params = new URLSearchParams(page.url.search);
		if (view === 'kanban') params.set('tampilan', 'kanban');
		else params.delete('tampilan');
		const s = params.toString();
		return s ? `?${s}` : '?';
	}

	const submitOnChange = (e: Event) => (e.currentTarget as HTMLSelectElement).form?.requestSubmit();

	const kanbanMeta = (p: (typeof data.prospects)[number]) =>
		[p.deadline && `Tenggat ${date(p.deadline)}`, daysAgo(p.statusSince)].filter(Boolean).join(' · ');
</script>

<svelte:head><title>Prospek · PM Workspace</title></svelte:head>

<header class="halaman-kepala">
	<div>
		<h1>Prospek</h1>
		<p>Semua calon proyek dan statusnya.</p>
	</div>
	<a class="btn primer" href="/prospek/baru"><Plus size={16} strokeWidth={2} aria-hidden="true" /> Tambah prospek</a>
</header>

{#if noneAtAll}
	<div class="kosong-blok">
		<Inbox size={20} strokeWidth={1.5} aria-hidden="true" />
		<strong>Belum ada prospek</strong>
		<p>Catat calon proyek pertama untuk mulai mengestimasi.</p>
		<a class="btn" href="/prospek/baru">Tambah prospek</a>
	</div>
{:else}
	<div class="alat">
		<form method="GET" class="filter" role="search" data-sveltekit-keepfocus data-sveltekit-noscroll>
			{#if data.view === 'kanban'}<input type="hidden" name="tampilan" value="kanban" />{/if}
			<label class="input-grup cari">
				<span class="affix"><Search size={16} strokeWidth={1.75} aria-hidden="true" /></span>
				<span class="sr-only">Cari nama prospek</span>
				<input type="search" name="q" value={data.filter.q} placeholder="Cari prospek" />
			</label>
			<label>
				<span class="sr-only">Status</span>
				<select name="status" value={data.filter.status} onchange={submitOnChange}>
					<option value="">Semua status</option>
					{#each PROSPECT_STATUSES as s (s)}<option value={s}>{STATUS_LABEL[s]}</option>{/each}
				</select>
			</label>
			<label>
				<span class="sr-only">Klien</span>
				<select name="client" value={data.filter.client} onchange={submitOnChange}>
					<option value="">Semua klien</option>
					{#each data.clients as c (c)}<option value={c}>{c}</option>{/each}
				</select>
			</label>
			<button class="sr-only">Terapkan filter</button>
			{#if filtered}
				<a class="btn teks" href={data.view === 'kanban' ? '?tampilan=kanban' : '?'}>Hapus filter</a>
			{/if}
		</form>

		<nav class="tampilan" aria-label="Tampilan">
			<a href={viewHref('daftar')} aria-current={data.view === 'daftar' ? 'page' : undefined}>
				<List size={16} strokeWidth={1.75} aria-hidden="true" /> Daftar
			</a>
			<a href={viewHref('kanban')} aria-current={data.view === 'kanban' ? 'page' : undefined}>
				<LayoutGrid size={16} strokeWidth={1.75} aria-hidden="true" /> Kanban
			</a>
		</nav>
	</div>

	{#if empty}
		<div class="kosong-blok">
			<strong>Tidak ada prospek yang cocok</strong>
			<p>Coba kata kunci lain atau hapus filter.</p>
		</div>
	{:else if data.view === 'daftar'}
		<div class="tabel-wadah">
			<table>
				<thead>
					<tr>
						<th>Prospek</th>
						<th>Status</th>
						<th>Tenggat</th>
						<th class="angka">Batas anggaran</th>
						<th>Status sejak</th>
					</tr>
				</thead>
				<tbody>
					{#each data.prospects as p (p.id)}
						<tr>
							<td class="nama">
								<a href="/prospek/{p.id}">{p.name}</a>
								{#if p.client}<span class="sub">{p.client}</span>{/if}
							</td>
							<td><span class="badge" class:final={p.status === 'deal'}>{STATUS_LABEL[p.status]}</span></td>
							<td>{p.deadline ? date(p.deadline) : '—'}</td>
							<td class="angka">{p.budget !== null ? rupiahShort(p.budget) : '—'}</td>
							<td class="redup">{daysAgo(p.statusSince)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="catatan-bawah">{data.prospects.length} prospek</p>
	{:else}
		{@const batalCount = data.prospects.filter((p) => p.status === 'batal').length}
		<div class="kanban">
			{#each KANBAN as status (status)}
				{@const items = data.prospects.filter((p) => p.status === status)}
				<section aria-labelledby="kolom-{status}">
					<h2 id="kolom-{status}">
						{STATUS_LABEL[status]}
						<span class="jumlah">{items.length}</span>
					</h2>
					{#if items.length === 0}
						<p class="kolom-kosong">Belum ada</p>
					{:else}
						<ul>
							{#each items as p (p.id)}
								<li>
									<a href="/prospek/{p.id}">{p.name}</a>
									{#if p.client}<span class="sub">{p.client}</span>{/if}
									<span class="sub redup">{kanbanMeta(p)}</span>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/each}
		</div>
		{#if batalCount > 0}
			<p class="catatan-bawah">{batalCount} prospek batal tidak ditampilkan. Pilih status Batal untuk melihatnya.</p>
		{/if}
	{/if}
{/if}

<style>
	.alat {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--jarak-4);
		flex-wrap: wrap;
		margin-bottom: var(--jarak-4);
	}
	.filter {
		display: flex;
		gap: var(--jarak-2);
		flex-wrap: wrap;
		align-items: center;
	}
	.cari {
		width: 260px;
	}
	.filter select {
		width: auto;
		min-width: 150px;
	}
	.tampilan {
		display: flex;
		padding: 3px;
		gap: 2px;
		border-radius: var(--radius-kecil);
		background: color-mix(in srgb, var(--kertas), var(--garis) 55%);
	}
	.tampilan a {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 32px;
		padding: 0 var(--jarak-3);
		border-radius: 4px;
		color: var(--tinta-2);
		font-size: var(--teks-kecil);
		font-weight: 500;
		text-decoration: none;
		transition: color var(--transisi), background-color var(--transisi);
	}
	.tampilan a:hover {
		color: var(--tinta);
	}
	.tampilan a[aria-current='page'] {
		color: var(--nila);
		background: var(--permukaan);
		box-shadow: 0 1px 2px rgba(28, 34, 48, 0.08);
	}
	.nama a {
		color: var(--tinta);
		font-weight: 500;
		text-decoration: none;
	}
	/* Seluruh baris bisa diklik. */
	tbody tr {
		position: relative;
	}
	.nama a::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	tbody tr:hover .nama a {
		color: var(--nila);
	}
	.sub {
		display: block;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.redup {
		color: var(--tinta-2);
	}
	.catatan-bawah {
		margin: var(--jarak-3) 0 0;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.kanban {
		display: grid;
		grid-template-columns: repeat(5, minmax(168px, 1fr));
		gap: var(--jarak-4);
		overflow-x: auto;
		padding-top: var(--jarak-2);
	}
	.kanban h2 {
		display: flex;
		align-items: center;
		gap: var(--jarak-2);
		font-size: var(--teks-kecil);
		font-weight: 600;
		letter-spacing: 0;
		padding-bottom: var(--jarak-2);
		margin-bottom: var(--jarak-1);
		border-bottom: 1.5px solid var(--tinta);
	}
	.jumlah {
		min-width: 20px;
		padding: 0 6px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--kertas), var(--garis) 60%);
		font-size: var(--teks-mini);
		font-weight: 500;
		text-align: center;
		color: var(--tinta-2);
	}
	.kanban ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.kanban li {
		position: relative;
		display: grid;
		gap: 2px;
		padding: var(--jarak-3) var(--jarak-2);
		border-bottom: 1px solid var(--garis);
		border-radius: var(--radius-kecil);
		transition: background-color var(--transisi);
	}
	.kanban li:hover {
		background: var(--permukaan);
	}
	.kanban li a {
		color: var(--tinta);
		font-weight: 500;
		text-decoration: none;
	}
	.kanban li a::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	.kolom-kosong {
		margin: var(--jarak-2) 0 0;
		padding: var(--jarak-4) var(--jarak-3);
		border: 1px dashed var(--garis-kuat);
		border-radius: var(--radius-kecil);
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
		text-align: center;
	}
	@media (max-width: 767px) {
		.cari {
			width: 100%;
		}
		/* Ponsel: cukup nama dan status; detail lain ada di halaman prospek. */
		th:nth-child(n + 3),
		td:nth-child(n + 3) {
			display: none;
		}
	}
</style>
