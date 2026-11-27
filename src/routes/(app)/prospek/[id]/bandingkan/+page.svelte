<script lang="ts">
	// Perbandingan antarversi estimasi (PRD F7): angka berdampingan beserta selisihnya, lalu apa yang berubah.
	import { goto } from '$app/navigation';
	import { ArrowLeft, ArrowRight } from '@lucide/svelte';
	import { decimal, rupiahShort } from '#lib/format/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let d = $derived(data.diff);

	const PRIORITY = { must: 'Must', should: 'Should', could: 'Could' } as const;
	const NOTE_LABEL = { assumptions: 'Asumsi', exclusions: 'Tidak termasuk', risks: 'Risiko' } as const;
	const num = (n: number, digits = 0) => decimal(n, digits);
	const delta = (n: number, fmt: (x: number) => string) => (Math.abs(n) < 0.005 ? '—' : `${n > 0 ? '+' : '−'}${fmt(Math.abs(n))}`);

	let rows = $derived([
		{ label: 'Jumlah fitur', a: num(d.a.features), b: num(d.b.features), diff: delta(d.b.features - d.a.features, (x) => num(x)) },
		{ label: 'Effort (jam)', a: num(d.a.effortHours, 1), b: num(d.b.effortHours, 1), diff: delta(d.b.effortHours - d.a.effortHours, (x) => num(x, 1)) },
		{ label: 'Orang', a: num(d.a.people, 1), b: num(d.b.people, 1), diff: delta(d.b.people - d.a.people, (x) => num(x, 1)) },
		{ label: 'Sprint', a: num(d.a.sprints), b: num(d.b.sprints), diff: delta(d.b.sprints - d.a.sprints, (x) => num(x)) },
		{ label: 'Durasi (bulan)', a: num(d.a.months, 1), b: num(d.b.months, 1), diff: delta(d.b.months - d.a.months, (x) => num(x, 1)) },
		{ label: 'Total biaya', a: rupiahShort(d.a.cost), b: rupiahShort(d.b.cost), diff: delta(d.b.cost - d.a.cost, rupiahShort) },
		{ label: 'Harga jual', a: rupiahShort(d.a.price), b: rupiahShort(d.b.price), diff: delta(d.b.price - d.a.price, rupiahShort) }
	]);
	let notes = $derived(d.notes.filter((n) => n.added.length || n.removed.length));
	let nothing = $derived(!d.added.length && !d.removed.length && !d.changed.length && !d.team.length && !d.rates.length && !d.settings.length && !notes.length);

	function choose(key: 'dari' | 'ke', value: string) {
		const q = new URLSearchParams({ dari: String(data.from), ke: String(data.to), [key]: value });
		goto(`?${q}`, { replaceState: true });
	}
</script>

<svelte:head><title>Bandingkan versi · {data.prospect.name} · PM Workspace</title></svelte:head>

<a class="kembali" href="/prospek/{data.prospect.id}"><ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" /> {data.prospect.name}</a>

<header class="halaman-kepala">
	<div>
		<h1>Bandingkan versi estimasi</h1>
		<p>Apa yang berubah antara dua versi, dan dampaknya ke angka.</p>
	</div>
</header>

<div class="pilih">
	<label class="field">
		<span class="field-label">Dari</span>
		<select value={String(data.from)} onchange={(e) => choose('dari', e.currentTarget.value)}>
			{#each data.versions as v (v.version)}<option value={String(v.version)}>Versi {v.version}{v.isFinal ? ' · final' : ''}</option>{/each}
		</select>
	</label>
	<ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
	<label class="field">
		<span class="field-label">Ke</span>
		<select value={String(data.to)} onchange={(e) => choose('ke', e.currentTarget.value)}>
			{#each data.versions as v (v.version)}<option value={String(v.version)}>Versi {v.version}{v.isFinal ? ' · final' : ''}</option>{/each}
		</select>
	</label>
</div>

<div class="tabel-wadah">
	<table>
		<thead>
			<tr>
				<th></th>
				<th class="angka"><a href="/prospek/{data.prospect.id}/estimasi/{d.a.version}">Versi {d.a.version}</a></th>
				<th class="angka"><a href="/prospek/{data.prospect.id}/estimasi/{d.b.version}">Versi {d.b.version}</a></th>
				<th class="angka">Selisih</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as r (r.label)}
				<tr>
					<th scope="row">{r.label}</th>
					<td class="angka">{r.a}</td>
					<td class="angka">{r.b}</td>
					<td class="angka" class:berubah={r.diff !== '—'}>{r.diff}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

{#if nothing}
	<p class="kosong">Tidak ada perbedaan isi antara kedua versi.</p>
{:else}
	<div class="bagian">
		{#if d.added.length || d.removed.length || d.changed.length}
			<section class="panel kartu" aria-labelledby="fitur-judul">
				<h2 id="fitur-judul">Fitur</h2>
				<ul class="perubahan">
					{#each d.added as f, i (i)}
						<li><span class="tanda tambah">Ditambah</span>{f.name} <span class="redup">{f.module} · {num(f.hours, 1)} jam</span></li>
					{/each}
					{#each d.removed as f, i (i)}
						<li><span class="tanda hapus">Dihapus</span><s>{f.name}</s> <span class="redup">{f.module} · {num(f.hours, 1)} jam</span></li>
					{/each}
					{#each d.changed as f, i (i)}
						<li>
							<span class="tanda ubah">Berubah</span>{f.name}
							<span class="redup">
								{#if Math.abs(f.hoursB - f.hoursA) >= 0.05}{num(f.hoursA, 1)} → {num(f.hoursB, 1)} jam{/if}
								{#if f.priorityA !== f.priorityB} · {PRIORITY[f.priorityA]} → {PRIORITY[f.priorityB]}{/if}
							</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if d.team.length || d.rates.length}
			<section class="panel kartu" aria-labelledby="tim-judul">
				<h2 id="tim-judul">Tim dan rate</h2>
				<ul class="perubahan">
					{#each d.team as t (t.role)}
						<li>{t.role} <span class="redup">{num(t.mpA, 1)} → {num(t.mpB, 1)} orang</span></li>
					{/each}
					{#each d.rates as r (r.role)}
						<li>Rate {r.role} <span class="redup">{r.rateA === null ? '–' : rupiahShort(r.rateA)} → {r.rateB === null ? '–' : rupiahShort(r.rateB)}/bulan</span></li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if d.settings.length}
			<section class="panel kartu" aria-labelledby="param-judul">
				<h2 id="param-judul">Parameter</h2>
				<ul class="perubahan">
					{#each d.settings as s (s.label)}<li>{s.label} <span class="redup">{s.from} → {s.to}</span></li>{/each}
				</ul>
			</section>
		{/if}

		{#each notes as n (n.kind)}
			<section class="panel kartu" aria-label={NOTE_LABEL[n.kind]}>
				<h2>{NOTE_LABEL[n.kind]}</h2>
				<ul class="perubahan">
					{#each n.added as l, i (i)}<li><span class="tanda tambah">Ditambah</span>{l}</li>{/each}
					{#each n.removed as l, i (i)}<li><span class="tanda hapus">Dihapus</span><s>{l}</s></li>{/each}
				</ul>
			</section>
		{/each}
	</div>
{/if}

<style>
	.pilih {
		display: flex;
		align-items: flex-end;
		gap: var(--jarak-3);
		margin-bottom: var(--jarak-6);
	}
	.pilih :global(svg) {
		margin-bottom: 10px;
		color: var(--tinta-2);
	}
	.pilih .field {
		width: 200px;
	}
	th[scope='row'] {
		font-weight: 500;
		text-align: left;
	}
	.berubah {
		font-weight: 600;
	}
	.kosong {
		margin-top: var(--jarak-6);
		color: var(--tinta-2);
	}
	.bagian {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
		gap: var(--jarak-4);
		margin-top: var(--jarak-6);
	}
	.kartu {
		display: grid;
		gap: var(--jarak-3);
		align-content: start;
		padding: var(--jarak-6);
	}
	h2 {
		margin: 0;
		font-size: var(--teks-isi);
	}
	.perubahan {
		display: grid;
		gap: var(--jarak-2);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--teks-kecil);
	}
	.tanda {
		display: inline-block;
		min-width: 64px;
		margin-right: var(--jarak-2);
		padding: 0 6px;
		border-radius: var(--radius-kecil);
		font-size: var(--teks-mini);
		font-weight: 500;
		text-align: center;
	}
	.tanda.tambah { background: var(--aman-tipis); color: var(--aman); }
	.tanda.hapus { background: var(--kritis-tipis); color: var(--kritis); }
	.tanda.ubah { background: var(--nila-tipis); color: var(--nila); }
	.redup {
		color: var(--tinta-2);
	}
	@media (max-width: 600px) {
		.pilih {
			flex-wrap: wrap;
		}
		.pilih .field {
			width: 100%;
		}
		.pilih :global(svg) {
			display: none;
		}
	}
</style>
