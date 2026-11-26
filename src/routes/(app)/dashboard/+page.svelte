<script lang="ts">
	// Dashboard utama: grafik ringkas dari prospek dan proyek. Batang satu warna (besaran), warna status hanya untuk status.
	import { LayoutDashboard } from '@lucide/svelte';
	import { date, decimal, rupiahShort } from '#lib/format/index.ts';
	import { STATUS_LABEL } from '#lib/labels.ts';
	import { HEALTH_BADGE, HEALTH_LABEL } from '#lib/project-status.ts';
	import { RAID_TYPE_LABEL } from '#lib/raid.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const pct = (n: number, max: number) => (max > 0 ? (n / max) * 100 : 0);
	const MONTH = new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: 'UTC' });
	const monthLabel = (m: string) => MONTH.format(new Date(m + '-01T00:00:00Z'));

	let healthTotal = $derived(data.health.reduce((a, h) => a + h.count, 0));
	let pipelineMax = $derived(Math.max(1, ...data.pipeline.map((s) => s.count)));
	let intakeMax = $derived(Math.max(1, ...data.intake.map((m) => m.count)));
	let roleMax = $derived(Math.max(1, ...data.roles.map((r) => r.mp)));
	let raidMax = $derived(Math.max(1, ...data.raidByType.map((r) => r.count)));
	let hasProspects = $derived(data.pipeline.some((s) => s.count > 0));
	const daysTo = (iso: string) => Math.round((Date.parse(iso) - Date.parse(data.today)) / 86_400_000);
</script>

<svelte:head><title>Dashboard · PM Workspace</title></svelte:head>

<header class="halaman-kepala">
	<div>
		<h1>Dashboard</h1>
		<p>Gambaran prospek dan proyek per {date(data.today)}.</p>
	</div>
</header>

<section class="panel kpi" aria-label="Angka utama">
	<div>
		<span class="label">Proyek aktif</span>
		<strong>{data.kpi.activeProjects}</strong>
	</div>
	<div>
		<span class="label">Nilai pipeline terbuka</span>
		<strong>{rupiahShort(data.kpi.openPipelineValue)}</strong>
		<span class="sub">{data.kpi.openPipelineCount} prospek belum diputuskan</span>
	</div>
	<div>
		<span class="label">Win rate</span>
		<strong>{data.kpi.winRate === null ? '—' : `${decimal(data.kpi.winRate, 0)}%`}</strong>
		<span class="sub">{data.kpi.decided ? `dari ${data.kpi.decided} prospek yang diputuskan` : 'belum ada deal atau batal'}</span>
	</div>
	<div>
		<span class="label">Risiko tinggi terbuka</span>
		<strong class:kritis-teks={data.kpi.highRisks > 0}>{data.kpi.highRisks}</strong>
		<span class="sub">di proyek aktif</span>
	</div>
</section>

<div class="grid">
	<!-- Kesehatan: satu keseluruhan dibagi ≤ 3 bagian → batang tersegmen tinggi (pengganti pie). -->
	<section class="panel kartu" aria-labelledby="kesehatan-judul">
		<h2 id="kesehatan-judul">Kesehatan proyek aktif</h2>
		{#if healthTotal === 0}
			<p class="kosong">Belum ada proyek aktif.</p>
		{:else}
			<div class="segmen" role="img" aria-label={data.health.map((h) => `${HEALTH_LABEL[h.health]} ${h.count}`).join(', ')}>
				{#each data.health.filter((h) => h.count > 0) as h (h.health)}
					<span
						class="blok {HEALTH_BADGE[h.health]} tip"
						style:flex-grow={h.count}
						data-tip="{HEALTH_LABEL[h.health]}: {h.count} proyek ({decimal(pct(h.count, healthTotal), 0)}%)"
					>{h.count}</span>
				{/each}
			</div>
			<ul class="legenda">
				{#each data.health as h (h.health)}
					<li><i class="swatch {HEALTH_BADGE[h.health]}"></i>{HEALTH_LABEL[h.health]} <span class="redup">{h.count}</span></li>
				{/each}
			</ul>
		{/if}
		<a class="tautan" href="/proyek">Lihat semua proyek →</a>
	</section>

	<!-- Progres per proyek: daftar meter, garis tegak = rencana hari ini. -->
	<section class="panel kartu" aria-labelledby="progres-judul">
		<h2 id="progres-judul">Progres vs rencana</h2>
		{#if data.progress.length === 0}
			<p class="kosong">Belum ada proyek aktif.</p>
		{:else}
			<ul class="meter">
				{#each data.progress as p (p.id)}
					<li>
						<a href="/proyek/{p.id}" class="nama">{p.name}</a>
						{#if p.started}
							<span
								class="lintasan tip"
								role="img"
								aria-label="{p.name}: progres {decimal(p.overall, 0)}%, rencana {decimal(p.expected, 0)}%"
								data-tip="Progres {decimal(p.overall, 0)}% · rencana hari ini {decimal(p.expected, 0)}%"
							>
								<span class="isi" style:width="{p.overall}%"></span>
								<span class="rencana" style:left="{p.expected}%"></span>
							</span>
							<span class="angka" class:waspada-teks={p.expected - p.overall > 15}>{decimal(p.overall, 0)}% <span class="redup">/ {decimal(p.expected, 0)}%</span></span>
						{:else}
							<span class="lintasan"></span>
							<span class="angka redup">mulai {date(p.startDate)}</span>
						{/if}
					</li>
				{/each}
			</ul>
			<p class="catatan"><i class="tanda-rencana"></i> rencana hari ini · angka: progres / rencana</p>
		{/if}
	</section>

	<!-- Pipeline: tahap berurutan, panjang = jumlah prospek, angka = nilai estimasi. -->
	<section class="panel kartu" aria-labelledby="pipeline-judul">
		<h2 id="pipeline-judul">Pipeline prospek</h2>
		{#if !hasProspects}
			<p class="kosong">Belum ada prospek.</p>
		{:else}
			<ul class="batang">
				{#each data.pipeline as s (s.status)}
					<li>
						<span class="nama">{STATUS_LABEL[s.status]}</span>
						<span class="lintasan">
							{#if s.count}
								<span
									class="isi tip"
									class:redup-isi={s.status === 'batal'}
									style:width="{pct(s.count, pipelineMax)}%"
									data-tip="{STATUS_LABEL[s.status]}: {s.count} prospek · {rupiahShort(s.value)}"
								></span>
							{/if}
						</span>
						<span class="angka">{s.count} <span class="redup">· {s.value ? rupiahShort(s.value) : '—'}</span></span>
					</li>
				{/each}
			</ul>
			<p class="catatan">Nilai = harga jual estimasi final, atau versi terbaru bila belum final.</p>
		{/if}
		<a class="tautan" href="/prospek">Lihat prospek →</a>
	</section>

	<!-- Tren: kolom satu warna, 6 bulan terakhir. -->
	<section class="panel kartu" aria-labelledby="masuk-judul">
		<h2 id="masuk-judul">Prospek masuk per bulan</h2>
		<div class="kolom" role="img" aria-label={data.intake.map((m) => `${monthLabel(m.month)} ${m.count} prospek, ${m.deals} deal`).join('; ')}>
			{#each data.intake as m (m.month)}
				<div class="kolom-item">
					<span class="nilai">{m.count || ''}</span>
					<span class="pilar">
						<span
							class="isi tip"
							style:height="{pct(m.count, intakeMax)}%"
							data-tip="{monthLabel(m.month)}: {m.count} prospek masuk · {m.deals} deal"
						></span>
					</span>
					<span class="bulan">{monthLabel(m.month)}</span>
				</div>
			{/each}
		</div>
		<p class="catatan">Deal per bulan: {data.intake.map((m) => `${monthLabel(m.month)} ${m.deals}`).join(' · ')}</p>
	</section>

	<!-- Beban per peran: batang terurut, besar ke kecil. -->
	<section class="panel kartu" aria-labelledby="peran-judul">
		<h2 id="peran-judul">Kebutuhan orang per peran</h2>
		{#if data.roles.length === 0}
			<p class="kosong">Belum ada proyek aktif.</p>
		{:else}
			<ul class="batang">
				{#each data.roles as r (r.name)}
					<li>
						<span class="nama">{r.name}</span>
						<span class="lintasan">
							<span class="isi tip" style:width="{pct(r.mp, roleMax)}%" data-tip="{r.name}: {decimal(r.mp, 2)} orang"></span>
						</span>
						<span class="angka">{decimal(r.mp, 1)} <span class="redup">org</span></span>
					</li>
				{/each}
			</ul>
			<p class="catatan">Jumlah orang di tim baseline semua proyek aktif.</p>
		{/if}
	</section>

	<!-- RAID terbuka per jenis; bagian risiko tinggi ditonjolkan. -->
	<section class="panel kartu" aria-labelledby="raid-judul">
		<h2 id="raid-judul">RAID terbuka</h2>
		{#if data.raidByType.every((r) => r.count === 0)}
			<p class="kosong">Tidak ada item RAID terbuka.</p>
		{:else}
			<ul class="batang">
				{#each data.raidByType as r (r.type)}
					<li>
						<span class="nama">{RAID_TYPE_LABEL[r.type]}</span>
						<span class="lintasan tumpuk">
							{#if r.high}<span class="isi kritis tip" style:width="{pct(r.high, raidMax)}%" data-tip="{r.high} risiko tinggi"></span>{/if}
							{#if r.count - r.high}<span class="isi tip" style:width="{pct(r.count - r.high, raidMax)}%" data-tip="{r.count - r.high} {RAID_TYPE_LABEL[r.type].toLowerCase()} lainnya"></span>{/if}
						</span>
						<span class="angka">{r.count}{#if r.high} <span class="kritis-teks">· {r.high} tinggi</span>{/if}</span>
					</li>
				{/each}
			</ul>
			<p class="catatan"><i class="swatch kritis"></i> risiko tinggi (skor ≥ 15) <i class="swatch nila"></i> lainnya</p>
		{/if}
	</section>
</div>

<section class="panel tenggat" aria-labelledby="tenggat-judul">
	<h2 id="tenggat-judul">Tenggat 14 hari ke depan</h2>
	{#if data.due.length === 0}
		<p class="kosong">Tidak ada aktivitas atau milestone yang jatuh tempo.</p>
	{:else}
		<ul>
			{#each data.due as d, i (i)}
				{@const n = daysTo(d.endDate)}
				<li>
					<span class="tgl">{date(d.endDate)}</span>
					<span class="apa">{d.kind === 'milestone' ? '◆ ' : ''}{d.name} <a href="/proyek/{d.projectId}?tab=jadwal" class="redup">{d.project}</a></span>
					<span class="sisa" class:kritis-teks={n < 0} class:waspada-teks={n >= 0 && n <= 3}>
						{n < 0 ? `terlambat ${-n} hari` : n === 0 ? 'hari ini' : `${n} hari lagi`}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>

{#if !hasProspects && data.kpi.activeProjects === 0}
	<div class="kosong-blok">
		<LayoutDashboard size={20} strokeWidth={1.5} aria-hidden="true" />
		<strong>Dashboard akan terisi otomatis</strong>
		<p>Mulai dengan menambahkan prospek dan estimasinya.</p>
		<a class="btn" href="/prospek/baru">Tambah prospek</a>
	</div>
{/if}

<style>
	.kpi {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		margin-bottom: var(--jarak-6);
	}
	.kpi > div {
		display: grid;
		gap: 2px;
		align-content: start;
		padding: var(--jarak-4) var(--jarak-6);
		border-right: 1px solid var(--garis);
	}
	.kpi > div:last-child {
		border-right: 0;
	}
	.kpi strong {
		font-size: var(--teks-h2);
		font-weight: 600;
		line-height: 1.2;
	}
	.label,
	.sub,
	.catatan {
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--jarak-4);
		margin-bottom: var(--jarak-4);
	}
	.kartu {
		display: grid;
		gap: var(--jarak-4);
		align-content: start;
		padding: var(--jarak-6);
	}
	h2 {
		margin: 0;
		font-size: var(--teks-isi);
		font-weight: 600;
	}
	.kosong {
		margin: 0;
		color: var(--tinta-2);
		font-size: var(--teks-kecil);
	}
	.catatan {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--jarak-2);
		margin: 0;
	}
	.tautan {
		justify-self: start;
		font-size: var(--teks-kecil);
		color: var(--nila);
		text-decoration: none;
	}
	.tautan:hover {
		text-decoration: underline;
	}

	/* ── Tooltip saat hover/fokus (interaction.md) ── */
	.tip {
		position: relative;
		outline: none;
	}
	/* Angka setiap tanda juga tercetak sebagai teks, jadi tooltip hanya pelengkap. */
	.tip:hover::after {
		content: attr(data-tip);
		position: absolute;
		bottom: calc(100% + 8px);
		left: 50%;
		z-index: 2;
		transform: translateX(-50%);
		padding: 6px 10px;
		border-radius: var(--radius-kecil);
		background: var(--tinta);
		color: #fff;
		font-size: var(--teks-mini);
		font-weight: 500;
		line-height: 1.4;
		white-space: nowrap;
		pointer-events: none;
	}

	/* ── Batang tersegmen (kesehatan) ── */
	.segmen {
		display: flex;
		gap: 2px;
		height: 28px;
	}
	.blok {
		display: flex;
		align-items: center;
		min-width: 28px;
		padding: 0 var(--jarak-2);
		border-radius: 4px;
		color: #fff;
		font-size: var(--teks-kecil);
		font-weight: 600;
		cursor: default;
	}
	.blok.aman { background: var(--aman); }
	.blok.waspada { background: var(--waspada-ikon); color: var(--tinta); }
	.blok.kritis { background: var(--kritis); }
	.legenda {
		display: flex;
		flex-wrap: wrap;
		gap: var(--jarak-2) var(--jarak-6);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--teks-kecil);
	}
	.legenda li {
		display: inline-flex;
		align-items: center;
		gap: var(--jarak-2);
	}
	.swatch {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 2px;
	}
	.swatch.aman { background: var(--aman); }
	.swatch.waspada { background: var(--waspada-ikon); }
	.swatch.kritis { background: var(--kritis); }
	.swatch.nila { background: var(--nila); }

	/* ── Batang horizontal dan meter ── */
	.batang,
	.meter {
		display: grid;
		gap: var(--jarak-3);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.batang li,
	.meter li {
		display: grid;
		grid-template-columns: minmax(90px, 30%) minmax(0, 1fr) auto;
		gap: var(--jarak-3);
		align-items: center;
		font-size: var(--teks-kecil);
	}
	.nama {
		overflow: hidden;
		color: var(--tinta);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	a.nama {
		text-decoration: none;
	}
	a.nama:hover {
		color: var(--nila);
	}
	.lintasan {
		position: relative;
		display: flex;
		gap: 2px;
		height: 12px;
		border-radius: 0 4px 4px 0;
		background: var(--nila-tipis);
	}
	.batang .lintasan {
		background: transparent;
		border-left: 1px solid var(--garis-kuat, var(--garis));
	}
	.lintasan .isi {
		display: block;
		height: 100%;
		border-radius: 0 4px 4px 0;
		background: var(--nila);
	}
	.lintasan .isi.kritis {
		background: var(--kritis);
	}
	.tumpuk .isi.kritis + .isi {
		border-radius: 0 4px 4px 0;
	}
	.tumpuk .isi.kritis:not(:last-child) {
		border-radius: 0;
	}
	.lintasan .isi.redup-isi {
		background: var(--nila-sedang);
	}
	.meter .lintasan {
		border-radius: 4px;
	}
	.meter .isi {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: 4px;
	}
	.meter .rencana,
	.tanda-rencana {
		width: 2px;
		background: var(--tinta);
	}
	.meter .rencana {
		position: absolute;
		top: -3px;
		bottom: -3px;
		margin-left: -1px;
	}
	.tanda-rencana {
		display: inline-block;
		height: 12px;
	}
	.angka {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		text-align: right;
	}

	/* ── Kolom (tren bulanan) ── */
	.kolom {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		height: 190px;
	}
	.kolom-item {
		display: grid;
		grid-template-rows: auto 1fr auto;
		justify-items: center;
		gap: var(--jarak-1);
		min-height: 0;
	}
	.nilai {
		font-size: var(--teks-kecil);
		font-variant-numeric: tabular-nums;
	}
	/* Garis dasar di bawah pilar; kolom menempel ke garis dasar. */
	.pilar {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		width: 100%;
		min-height: 0;
		border-bottom: 1px solid var(--garis-kuat, var(--garis));
	}
	.pilar .isi {
		display: block;
		width: min(24px, 60%);
		border-radius: 4px 4px 0 0;
		background: var(--nila);
	}
	.bulan {
		font-size: var(--teks-mini);
		color: var(--tinta-2);
	}

	/* ── Tenggat ── */
	.tenggat {
		padding: var(--jarak-6);
	}
	.tenggat h2 {
		margin-bottom: var(--jarak-3);
	}
	.tenggat ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.tenggat li {
		display: grid;
		grid-template-columns: 110px minmax(0, 1fr) auto;
		gap: var(--jarak-4);
		padding: var(--jarak-2) 0;
		border-top: 1px solid var(--garis);
		font-size: var(--teks-kecil);
	}
	.tenggat li:first-child {
		border-top: 0;
	}
	.tenggat li {
		grid-template-areas: 'tgl apa sisa';
	}
	.tgl {
		grid-area: tgl;
		font-variant-numeric: tabular-nums;
	}
	.apa {
		grid-area: apa;
	}
	.sisa {
		grid-area: sisa;
		text-align: right;
		white-space: nowrap;
	}
	.apa a {
		margin-left: var(--jarak-2);
		text-decoration: none;
	}
	.redup {
		color: var(--tinta-2);
	}
	.kritis-teks {
		color: var(--kritis);
		font-weight: 600;
	}
	.waspada-teks {
		color: var(--waspada);
	}
	@media (max-width: 600px) {
		.tenggat li {
			grid-template-columns: 1fr auto;
			grid-template-areas: 'tgl sisa' 'apa apa';
			gap: 2px var(--jarak-4);
		}
		.apa a {
			display: block;
			margin-left: 0;
		}
	}
	@media (max-width: 900px) {
		.grid {
			grid-template-columns: 1fr;
		}
		.kpi {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.kpi > div:nth-child(2) {
			border-right: 0;
		}
		.kpi > div:nth-child(-n + 2) {
			border-bottom: 1px solid var(--garis);
		}
	}
</style>
