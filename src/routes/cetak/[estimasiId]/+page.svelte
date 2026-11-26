<script lang="ts">
	// Ringkasan direksi (PRD F8, design.md 5.4): satu halaman A4, dicetak/disimpan PDF lewat browser.
	import { page } from '$app/state';
	import { ArrowLeft, Printer } from '@lucide/svelte';
	import { pertE } from '#lib/calc/pert.ts';
	import RangeBand from '#lib/components/RangeBand.svelte';
	import { calendarFor, computeDraft } from '#lib/estimate.ts';
	import { dateLong, decimal, lines, percentBp, range, rupiah, rupiahShort } from '#lib/format/index.ts';
	import { roleLabel } from '#lib/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const flag = (key: string, fallback: boolean) => {
		const v = page.url.searchParams.get(key);
		return v === null ? fallback : v === '1';
	};
	// Rate per peran tidak selalu perlu dilihat audiens, jadi disembunyikan secara default (F8).
	let showRates = $state(flag('rate', false));
	let showTm = $state(flag('tm', true));
	let showAppendix = $state(flag('lampiran', true));

	let est = $derived(data.estimate);
	let draft = $derived(est.draft);
	let s = $derived(draft.settings);
	let r = $derived(computeDraft(draft, est.rates, est.holidays));
	let cal = $derived(calendarFor(draft, est.holidays));
	let likely = $derived(r.likely);
	let cost = $derived(likely.cost);
	let stab = $derived(s.stabilizationSprints);
	const sprintsOf = (x: { sprint: { devSprintsRaw: number } }) => x.sprint.devSprintsRaw + stab;

	const roleName = (id: number) => {
		const role = est.rates.find((x) => x.roleId === id);
		return role ? roleLabel(role) : `Peran #${id}`;
	};

	let modules = $derived.by(() => {
		const map = new Map<string, typeof draft.features>();
		for (const f of draft.features) {
			const key = f.module.trim() || 'Lainnya';
			map.set(key, [...(map.get(key) ?? []), f]);
		}
		return [...map];
	});
	let team = $derived(cost.roles.filter((x) => x.mp > 0));
	let risks = $derived(lines(draft.risks).slice(0, 3));
	let docDate = $derived(dateLong(est.finalizedAt ?? new Date()));
	const priorityNote = { must: '', should: ' (prioritas kedua)', could: ' (opsional)' } as const;
	const PRIORITY = { must: 'Must', should: 'Should', could: 'Could' } as const;
	const featureHours = (f: (typeof draft.features)[number]) =>
		Object.values(f.efforts).reduce(
			(a, t) => ({ o: a.o + t.o, e: a.e + pertE(t), p: a.p + t.p }),
			{ o: 0, e: 0, p: 0 }
		);
</script>

<svelte:head><title>Ringkasan estimasi · {data.prospect.name}</title></svelte:head>

<div class="alat">
	<a class="kembali" href="/prospek/{data.prospect.id}/estimasi/{est.version}">
		<ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" /> Kembali ke estimasi
	</a>
	<div class="opsi">
		<label><input type="checkbox" bind:checked={showRates} /> Rincian rate per peran</label>
		<label><input type="checkbox" bind:checked={showTm} /> Time &amp; material</label>
		<label><input type="checkbox" bind:checked={showAppendix} /> Lampiran rincian fitur</label>
	</div>
	<button class="btn primer" onclick={() => print()}><Printer size={16} strokeWidth={1.75} aria-hidden="true" /> Cetak / simpan PDF</button>
</div>

<article class="lembar">
	<header class="kop">
		<p class="label">Estimasi Proyek</p>
		<h1>{data.prospect.name}</h1>
		<p class="meta">
			{[data.prospect.client, `Versi ${est.version}`, docDate].filter(Boolean).join(' · ')}
			{#if !est.isFinal}<span class="draf">Draf, belum final</span>{/if}
		</p>
	</header>

	<section class="dua angka-utama">
		<div>
			<h2 class="label">Durasi</h2>
			<p class="besar">{likely.sprint.totalSprints} <span class="satuan">sprint</span></p>
			<p class="setara">± {decimal(likely.sprint.months, 1)} bulan</p>
			<p class="ket">
				Rentang {range(String(r.low.sprint.totalSprints), String(r.high.sprint.totalSprints))} sprint
				({range(decimal(r.low.sprint.months, 1), decimal(r.high.sprint.months, 1))} bulan)
				{#if cal}<br />Mulai {dateLong(cal.start)}, selesai ± {dateLong(cal.endDate(likely.sprint.totalSprints))}{/if}
			</p>
			<RangeBand
				size="besar"
				o={sprintsOf(r.optimistic)}
				lo={sprintsOf(r.low)}
				e={sprintsOf(likely)}
				hi={sprintsOf(r.high)}
				p={sprintsOf(r.pessimistic)}
				format={(n) => decimal(n, 1)}
				label="Durasi"
			/>
		</div>
		<div>
			<h2 class="label">Harga</h2>
			<p class="besar">{rupiahShort(cost.price)}</p>
			<p class="setara">fixed price</p>
			<p class="ket">Rentang {range(rupiahShort(r.low.cost.price), rupiahShort(r.high.cost.price))}</p>
			<RangeBand
				size="besar"
				o={r.optimistic.cost.price}
				lo={r.low.cost.price}
				e={cost.price}
				hi={r.high.cost.price}
				p={r.pessimistic.cost.price}
				label="Harga"
			/>
			<dl class="rincian">
				<dt>Total biaya</dt>
				<dd>{rupiahShort(cost.total)}</dd>
				<dt>Margin</dt>
				<dd>{decimal(cost.margin * 100, 1)}%</dd>
				{#if data.prospect.budget !== null}
					<dt>Anggaran klien</dt>
					<dd>{rupiahShort(data.prospect.budget)}{cost.price > data.prospect.budget ? ' (terlampaui)' : ''}</dd>
				{/if}
			</dl>
			{#if showTm}
				<p class="tm">
					Alternatif time &amp; material: {rupiahShort(cost.tmMonthlyRate)} per bulan, perkiraan total
					{rupiahShort(cost.tmTotal)} ({range(rupiahShort(r.low.cost.tmTotal), rupiahShort(r.high.cost.tmTotal))}), tanpa contingency.
				</p>
			{/if}
		</div>
	</section>

	<section class="dua" class:tumpuk={showRates}>
		<div>
			<h2 class="judul">Ruang lingkup</h2>
			<ul class="lingkup">
				{#each modules as [name, features] (name)}
					<li>
						<strong>{name}</strong>
						<span>{features.map((f) => (f.name || 'Tanpa nama') + priorityNote[f.priority]).join(', ')}</span>
					</li>
				{/each}
			</ul>
		</div>
		<div>
			<h2 class="judul">Tim</h2>
			<table class="tim">
				<thead>
					<tr>
						<th>Peran</th>
						<th class="angka">Orang</th>
						<th class="angka">Keterlibatan</th>
						{#if showRates}<th class="angka">Rate / bulan</th><th class="angka">Biaya</th>{/if}
					</tr>
				</thead>
				<tbody>
					{#each team as m (m.roleId)}
						<tr>
							<td>{roleName(m.roleId)}</td>
							<td class="angka">{decimal(m.mp, 2)}</td>
							<td class="angka">{decimal(m.months, 1)} bln</td>
							{#if showRates}<td class="angka">{rupiah(m.rate)}</td><td class="angka">{rupiah(m.amount)}</td>{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section class="tiga">
		<div>
			<h2 class="judul">Asumsi</h2>
			{#if lines(draft.assumptions).length}
				<ul>{#each lines(draft.assumptions) as l, i (i)}<li>{l}</li>{/each}</ul>
			{:else}<p class="kosong">—</p>{/if}
		</div>
		<div>
			<h2 class="judul">Tidak termasuk</h2>
			{#if lines(draft.exclusions).length}
				<ul>{#each lines(draft.exclusions) as l, i (i)}<li>{l}</li>{/each}</ul>
			{:else}<p class="kosong">—</p>{/if}
		</div>
		<div>
			<h2 class="judul">Risiko utama</h2>
			{#if risks.length}
				<ol>{#each risks as l, i (i)}<li>{l}</li>{/each}</ol>
			{:else}<p class="kosong">—</p>{/if}
		</div>
	</section>

	<footer class="catatan">
		Durasi dan harga disajikan sebagai rentang (± {decimal(s.rangeSigma, 1)}σ dari estimasi tiga titik PERT). Nilai paling
		mungkin adalah perkiraan, bukan janji pasti. Termasuk contingency {percentBp(s.contingencyBp)} dan
		{stab} sprint stabilisasi; 1 sprint = {s.sprintWeeks} minggu.{cal
			? ' Hari kerja sudah dikurangi libur nasional dan cuti bersama sesuai SKB 3 Menteri.'
			: ''}
	</footer>
</article>

{#if showAppendix}
	<article class="lembar lampiran">
		<header class="kop kecil">
			<p class="label">Lampiran · {data.prospect.name} · Versi {est.version}</p>
			<h1>Rincian fitur</h1>
		</header>
		<table class="fitur">
			<thead>
				<tr>
					<th>Modul</th>
					<th>Fitur</th>
					<th>Prioritas</th>
					<th class="angka">Effort (jam)</th>
					<th class="angka">Rentang (jam)</th>
				</tr>
			</thead>
			<tbody>
				{#each draft.features as f, i (i)}
					{@const h = featureHours(f)}
					<tr>
						<td>{f.module}</td>
						<td>{f.name}</td>
						<td>{PRIORITY[f.priority]}</td>
						<td class="angka">{decimal(h.e, 1)}</td>
						<td class="angka">{range(decimal(h.o, 0), decimal(h.p, 0))}</td>
					</tr>
				{/each}
			</tbody>
			<tfoot>
				<tr>
					<td colspan="3">Total</td>
					<td class="angka">{decimal(r.totalEffort.e, 1)}</td>
					<td class="angka">{range(decimal(r.totalEffort.o, 0), decimal(r.totalEffort.p, 0))}</td>
				</tr>
			</tfoot>
		</table>
		<p class="catatan">
			Parameter: sprint {s.sprintWeeks} minggu, {decimal(s.workDaysPerSprint, 1)} hari kerja, {decimal(s.effectiveHoursPerDay, 1)} jam efektif
			per hari, focus factor {decimal(s.focusFactor, 2)}, contingency {percentBp(s.contingencyBp)}, markup {percentBp(s.markupBp)}.
		</p>
	</article>
{/if}

<style>
	@page {
		size: A4;
		margin: 18mm;
	}
	.alat {
		position: sticky;
		top: 0;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: var(--jarak-6);
		padding: var(--jarak-3) var(--jarak-6);
		background: var(--permukaan);
		border-bottom: 1px solid var(--garis);
	}
	.alat .kembali {
		margin: 0;
	}
	.opsi {
		display: flex;
		gap: var(--jarak-4);
		margin-left: auto;
		font-size: var(--teks-kecil);
	}
	.opsi label {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
	}
	.opsi input {
		accent-color: var(--nila);
	}

	/* Di layar: lembar A4 di atas kertas. */
	.lembar {
		width: 210mm;
		min-height: 297mm;
		margin: var(--jarak-8) auto;
		padding: 18mm;
		background: #fff;
		border: 1px solid var(--garis);
		border-radius: 4px;
		display: flex;
		flex-direction: column;
		gap: 8mm;
		font-size: 13px;
		line-height: 1.5;
		-webkit-print-color-adjust: exact;
		print-color-adjust: exact;
	}
	.kop {
		padding-bottom: 5mm;
		border-bottom: 1.5px solid var(--tinta);
	}
	.label {
		margin: 0;
		font-size: var(--teks-kecil);
		font-weight: 500;
		color: var(--tinta-2);
	}
	h1 {
		margin: 2px 0 0;
		font-size: 26px;
	}
	.kop.kecil h1 {
		font-size: var(--teks-h3);
	}
	.meta {
		display: flex;
		align-items: center;
		gap: var(--jarak-3);
		margin: var(--jarak-1) 0 0;
		color: var(--tinta-2);
	}
	.draf {
		padding: 1px 6px;
		border: 1px solid var(--waspada-ikon);
		border-radius: var(--radius-kecil);
		color: var(--waspada);
		font-size: var(--teks-mini);
		font-weight: 500;
	}
	.dua {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10mm;
	}
	/* Dengan rate, tabel tim butuh ruang lebih: ruang lingkup dipersempit. */
	.dua.tumpuk {
		grid-template-columns: 0.75fr 1.5fr;
		gap: 7mm;
	}
	.tim td:first-child {
		white-space: nowrap;
	}
	.tiga {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 7mm;
		padding-top: 5mm;
		border-top: 1px solid var(--garis);
	}
	.angka-utama {
		padding-bottom: 6mm;
		border-bottom: 1px solid var(--garis);
	}
	.besar {
		margin: var(--jarak-1) 0 0;
		font-size: var(--teks-angka-besar);
		line-height: 1.1;
		font-weight: 600;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}
	.satuan {
		font-size: var(--teks-isi);
		font-weight: 500;
		letter-spacing: 0;
		color: var(--tinta-2);
	}
	.setara {
		margin: 0;
		font-size: var(--teks-isi);
		font-weight: 500;
	}
	.ket {
		margin: var(--jarak-1) 0 var(--jarak-3);
		color: var(--tinta-2);
		font-size: var(--teks-kecil);
	}
	.rincian {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 2px var(--jarak-4);
		margin: var(--jarak-4) 0 0;
		font-size: var(--teks-kecil);
	}
	.rincian dt {
		color: var(--tinta-2);
	}
	.rincian dd {
		margin: 0;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.tm {
		margin: var(--jarak-3) 0 0;
		padding-top: var(--jarak-2);
		border-top: 1px dashed var(--garis);
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.judul {
		margin: 0 0 var(--jarak-2);
		font-size: var(--teks-isi);
	}
	.lingkup {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--jarak-2);
	}
	.lingkup strong {
		display: block;
		font-weight: 600;
	}
	.lingkup span {
		color: var(--tinta-2);
	}
	table {
		background: none;
		font-size: var(--teks-kecil);
	}
	th,
	td {
		padding: 5px var(--jarak-2) 5px 0;
	}
	th:last-child,
	td:last-child {
		padding-right: 0;
	}
	th {
		position: static;
		background: none;
	}
	tbody tr:hover {
		background: none;
	}
	tbody tr:last-child td {
		border-bottom: 1px solid var(--garis);
	}
	tfoot td {
		font-weight: 600;
		border-bottom: 0;
	}
	.tiga ul,
	.tiga ol {
		margin: 0;
		padding-left: 1.1em;
	}
	.tiga li + li {
		margin-top: 2px;
	}
	.kosong {
		margin: 0;
		color: var(--tinta-2);
	}
	.catatan {
		margin-top: auto;
		padding-top: 4mm;
		border-top: 1px solid var(--garis);
		font-size: var(--teks-mini);
		color: var(--tinta-2);
	}

	@media print {
		:global(body) {
			background: #fff !important;
		}
		.alat {
			display: none;
		}
		.lembar {
			width: auto;
			min-height: calc(297mm - 36mm);
			margin: 0;
			padding: 0;
			border: 0;
			border-radius: 0;
		}
		.lampiran {
			break-before: page;
		}
		section,
		tr {
			break-inside: avoid;
		}
	}
	@media screen and (max-width: 860px) {
		.lembar {
			width: auto;
			margin: var(--jarak-4);
			padding: var(--jarak-6);
		}
		.alat {
			flex-wrap: wrap;
		}
		.opsi {
			margin-left: 0;
			flex-wrap: wrap;
		}
	}
</style>
