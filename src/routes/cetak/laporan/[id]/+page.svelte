<script lang="ts">
	// Laporan status mingguan untuk dicetak/PDF (A4). Template Direksi (ringkas) atau Teknis (rinci).
	import { page } from '$app/state';
	import { ArrowLeft, Printer } from '@lucide/svelte';
	import { dateLong, date, decimal, rupiahShort } from '#lib/format/index.ts';
	import { CR_STATUS_LABEL } from '#lib/change-request.ts';
	import { HEALTH_LABEL } from '#lib/project-status.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let teknis = $derived(page.url.searchParams.get('template') === 'teknis');
	let c = $derived(data.content);
	let r = $derived(data.report);
	let risks = $derived(c.openRaid.filter((x) => x.type === 'risk'));
	let issues = $derived(c.openRaid.filter((x) => x.type === 'issue'));
	const SEV = { tinggi: 'Tinggi', sedang: 'Sedang', rendah: 'Rendah' } as const;
	let narasi = $derived([
		['Pencapaian minggu ini', r.achievements],
		['Kendala', r.obstacles],
		['Rencana minggu depan', r.nextWeek],
		['Bantuan yang dibutuhkan', r.helpNeeded]
	] as const);
	const signed = (n: number, d = 0) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${decimal(Math.abs(n), d)}`;
	const money = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${rupiahShort(Math.abs(n))}`;
	/** Teks aman untuk string CSS `content` (tanpa kutip, garis miring terbalik, atau penutup tag). */
	const cssText = (t: string) => t.replace(/[\\"<>\n\r]/g, ' ');
	const lines = (t: string) => t.split('\n').map((l) => l.trim()).filter(Boolean);
</script>

<svelte:head>
	<title>Laporan {data.project.name} · {date(r.periodStart)}</title>
	{#if teknis}
		<!-- Template Teknis bisa lebih dari satu halaman: kop dan "halaman n/m" diulang di setiap halaman (design.md 6.13). -->
		{@html `<style>@page { @top-left { content: "${cssText(`${data.project.name} · ${date(r.periodStart)} – ${date(r.periodEnd)}`)}"; font: 9pt 'IBM Plex Sans', sans-serif; color: #596273; } @top-right { content: "Halaman " counter(page) "/" counter(pages); font: 9pt 'IBM Plex Sans', sans-serif; color: #596273; } }</style>`}
	{/if}
</svelte:head>

<div class="alat">
	<a class="kembali" href="/proyek/{data.project.id}?tab=laporan"><ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" /> Kembali ke proyek</a>
	<nav class="templat" aria-label="Template">
		<a href="?template=direksi" aria-current={!teknis ? 'page' : undefined} data-sveltekit-replacestate>Direksi</a>
		<a href="?template=teknis" aria-current={teknis ? 'page' : undefined} data-sveltekit-replacestate>Teknis</a>
	</nav>
	<button class="btn primer" onclick={() => print()}><Printer size={16} strokeWidth={1.75} aria-hidden="true" /> Cetak / simpan PDF</button>
</div>

<article class="lembar">
	<header class="kop">
		<p class="label">Laporan Status Mingguan{teknis ? ' · Teknis' : ''}</p>
		<h1>{data.project.name}</h1>
		<p class="meta">
			{[data.project.client, `${dateLong(r.periodStart)} – ${dateLong(r.periodEnd)}`].filter(Boolean).join(' · ')}
			{#if !r.sentAt}<span class="draf">Draf</span>{/if}
		</p>
	</header>

	<section class="status">
		<span class="kesehatan {c.health}">{HEALTH_LABEL[c.health]}</span>
		<div>
			{#if c.reasons.length}
				<ul>{#each c.reasons as reason, i (i)}<li>{reason}</li>{/each}</ul>
			{:else}
				<p>Jadwal dan risiko sesuai rencana.</p>
			{/if}
		</div>
	</section>

	<section class="angka">
		<div>
			<span class="label">Progres</span>
			<strong>{decimal(c.progress.overall, 0)}%</strong>
			<span class="sub">rencana {decimal(c.progress.expected, 0)}% · {c.features.done}/{c.features.total} fitur selesai</span>
		</div>
		<div>
			<span class="label">Selesai (rencana)</span>
			<strong>{date(c.plannedEnd)}</strong>
			<span class="sub">{c.slipDays > 0 ? `${c.slipDays} hari setelah baseline (${date(c.baselineEnd)})` : 'sesuai baseline'}</span>
		</div>
		<div>
			<span class="label">Risiko tinggi</span>
			<strong>{risks.filter((x) => x.severity === 'tinggi').length}</strong>
			<span class="sub">{issues.length} isu terbuka · {c.newRaidThisWeek} item RAID baru</span>
		</div>
	</section>

	<section class="narasi">
		{#each narasi as [label, text] (label)}
			<div>
				<h2>{label}</h2>
				{#if lines(text).length}
					<ul>{#each lines(text) as l, i (i)}<li>{l}</li>{/each}</ul>
				{:else}<p class="kosong">–</p>{/if}
			</div>
		{/each}
	</section>

	<section class="dua">
		<div>
			<h2>Aktivitas minggu ini dan depan</h2>
			{#if c.upcoming.length}
				<ul class="aktivitas">
					{#each c.upcoming as a, i (i)}
						<li>
							<span>{a.done ? '✓ ' : ''}{a.kind === 'milestone' ? '◆ ' : ''}{a.name}</span>
							<span class="tgl">{a.kind === 'milestone' ? date(a.startDate) : `${date(a.startDate)} – ${date(a.endDate)}`}</span>
						</li>
					{/each}
				</ul>
			{:else}<p class="kosong">–</p>{/if}
		</div>
		<div>
			<h2>Risiko utama</h2>
			{#if risks.length}
				<ol>
					{#each risks.slice(0, 3) as x, i (i)}
						<li>
							{x.description}
							{#if x.score}<span class="skor">{x.score} · {SEV[x.severity!]}</span>{/if}
							{#if x.mitigation}<span class="mitigasi">Mitigasi: {x.mitigation}</span>{/if}
						</li>
					{/each}
				</ol>
			{:else}<p class="kosong">Tidak ada risiko terbuka.</p>{/if}
		</div>
	</section>

	{#if c.decisions?.length}
		<section>
			<h2>Keputusan minggu ini</h2>
			<table>
				<thead><tr><th>No.</th><th>Tanggal</th><th>Keputusan</th><th>Oleh</th></tr></thead>
				<tbody>
					{#each c.decisions as d, i (i)}
						<tr>
							<td>{d.label}</td>
							<td>{date(d.date)}</td>
							<td>{d.decision}{d.supersedes ? ` (menggantikan ${d.supersedes})` : ''}</td>
							<td>{d.decidedBy || '–'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/if}

	{#if c.changeRequests?.length || c.scope?.count}
		<section>
			<h2>Change request</h2>
			{#if c.scope?.count}
				<p class="scope">
					{c.scope.count} CR disetujui sejak baseline: {signed(c.scope.effortPct, 1)}% effort · {signed(c.scope.sprints)} sprint · {money(c.scope.price)} harga jual.
				</p>
			{/if}
			{#if c.changeRequests?.length}
				<table>
					<thead><tr><th>No.</th><th>Perubahan</th><th>Status</th><th class="kanan">Sprint</th><th class="kanan">Harga</th></tr></thead>
					<tbody>
						{#each c.changeRequests as cr, i (i)}
							<tr>
								<td>{cr.label}</td>
								<td>{cr.title}</td>
								<td>{CR_STATUS_LABEL[cr.status]}{cr.decisionDate ? ` ${date(cr.decisionDate)}` : ''}</td>
								<td class="kanan">{signed(cr.sprints)}</td>
								<td class="kanan">{money(cr.price)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</section>
	{/if}

	{#if teknis}
		{#if c.late.length}
			<section>
				<h2>Terlambat</h2>
				<table>
					<thead><tr><th>Item</th><th>Jenis</th><th>Rencana selesai</th></tr></thead>
					<tbody>{#each c.late as l, i (i)}<tr><td>{l.name}</td><td>{l.kind}</td><td>{date(l.endDate)}</td></tr>{/each}</tbody>
				</table>
			</section>
		{/if}
		<section>
			<h2>Progres fitur</h2>
			<table>
				<thead><tr><th>Modul</th><th>Fitur</th><th class="kanan">Progres</th><th>Rencana selesai</th></tr></thead>
				<tbody>
					{#each c.featureList as f, i (i)}
						<tr><td>{f.module}</td><td>{f.name}{f.late ? ' (terlambat)' : ''}</td><td class="kanan">{f.progress}%</td><td>{date(f.endDate)}</td></tr>
					{/each}
				</tbody>
			</table>
		</section>
		{#if c.openRaid.length}
			<section>
				<h2>RAID terbuka</h2>
				<table>
					<thead><tr><th>Jenis</th><th>Deskripsi</th><th>Pemilik</th><th>Skor</th><th>Mitigasi / tindakan</th></tr></thead>
					<tbody>
						{#each c.openRaid as x, i (i)}
							<tr>
								<td>{x.typeLabel}</td>
								<td>{x.description}{x.reviewOverdue ? ' (lewat tanggal tinjau)' : ''}</td>
								<td>{x.owner || '–'}</td>
								<td>{x.score ? `${x.score} · ${SEV[x.severity!]}` : '–'}</td>
								<td>{x.mitigation || '–'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		{/if}
	{/if}

	<footer class="catatan">
		Data per {dateLong(c.generatedOn)}{r.sentAt ? `, dibekukan saat dikirim ${dateLong(r.sentAt)}` : ' (draf, dapat berubah)'}. Status:
		Merah bila proyeksi selesai mundur &gt; 20% atau ada risiko tinggi tanpa mitigasi; Kuning bila mundur 10–20%, ada item
		terlambat, progres &gt; 15 poin di bawah rencana, atau blocker (isu terbuka) &gt; 2 hari. CR yang disetujui menggeser target selesai.
	</footer>
</article>

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
		margin: 0 auto 0 0;
	}
	.templat {
		display: flex;
		padding: 3px;
		gap: 2px;
		border-radius: var(--radius-kecil);
		background: color-mix(in srgb, var(--kertas), var(--garis) 55%);
	}
	.templat a {
		padding: 4px var(--jarak-3);
		border-radius: 4px;
		color: var(--tinta-2);
		font-size: var(--teks-kecil);
		font-weight: 500;
		text-decoration: none;
	}
	.templat a[aria-current='page'] {
		background: var(--permukaan);
		color: var(--nila);
	}
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
		gap: 6mm;
		font-size: 12.5px;
		line-height: 1.5;
		-webkit-print-color-adjust: exact;
		print-color-adjust: exact;
	}
	.kop {
		padding-bottom: 4mm;
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
		font-size: 24px;
	}
	h2 {
		margin: 0 0 var(--jarak-1);
		font-size: var(--teks-isi);
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
	.status {
		display: flex;
		gap: var(--jarak-4);
		align-items: flex-start;
	}
	.status ul,
	.status p {
		margin: 0;
		padding-left: 1.1em;
	}
	.status p {
		padding: 0;
	}
	.kesehatan {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 12px;
		border-radius: var(--radius-kecil);
		font-weight: 600;
		font-size: var(--teks-isi);
	}
	.kesehatan::before {
		content: '';
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: currentColor;
	}
	.kesehatan.hijau { background: var(--aman-tipis); color: var(--aman); }
	.kesehatan.kuning { background: var(--waspada-tipis); color: var(--waspada); }
	.kesehatan.merah { background: var(--kritis-tipis); color: var(--kritis); }
	.angka {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6mm;
		padding: 4mm 0;
		border-top: 1px solid var(--garis);
		border-bottom: 1px solid var(--garis);
	}
	.angka div {
		display: grid;
		gap: 1px;
	}
	.angka strong {
		font-size: 22px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.sub {
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.narasi {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 5mm 8mm;
	}
	.narasi ul,
	.dua ul,
	.dua ol {
		margin: 0;
		padding-left: 1.1em;
	}
	.dua {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8mm;
		padding-top: 4mm;
		border-top: 1px solid var(--garis);
	}
	.aktivitas {
		list-style: none;
		padding: 0 !important;
	}
	.aktivitas li {
		display: flex;
		justify-content: space-between;
		gap: var(--jarak-3);
		padding: 2px 0;
		border-bottom: 1px solid var(--garis);
	}
	.tgl,
	.mitigasi {
		color: var(--tinta-2);
		font-size: var(--teks-kecil);
	}
	.mitigasi {
		display: block;
	}
	.skor {
		margin-left: 4px;
		font-size: var(--teks-mini);
		font-weight: 600;
	}
	.kosong {
		margin: 0;
		color: var(--tinta-2);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		background: none;
		font-size: var(--teks-kecil);
	}
	th,
	td {
		padding: 4px var(--jarak-2) 4px 0;
		border-bottom: 1px solid var(--garis);
		text-align: left;
		vertical-align: top;
	}
	th {
		position: static;
		background: none;
	}
	tbody tr:hover {
		background: none;
	}
	.kanan {
		text-align: right;
	}
	.catatan {
		margin-top: auto;
		padding-top: 3mm;
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
		}
		section,
		tr {
			break-inside: avoid;
		}
	}
</style>
