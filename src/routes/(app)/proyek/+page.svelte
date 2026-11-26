<script lang="ts">
	import { FolderKanban, Info } from '@lucide/svelte';
	import { date, decimal } from '#lib/format/index.ts';
	import { HEALTHS, HEALTH_BADGE, HEALTH_LABEL } from '#lib/project-status.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const STATUS = { aktif: 'Aktif', selesai: 'Selesai', ditunda: 'Ditunda' } as const;
	let active = $derived(data.projects.filter((p) => p.status === 'aktif'));
	let inactive = $derived(data.projects.filter((p) => p.status !== 'aktif'));
	const count = (h: (typeof HEALTHS)[number]) => active.filter((p) => p.health === h).length;
	const sum = (k: 'highRisks' | 'blockers' | 'pendingCr') => active.reduce((a, p) => a + p[k], 0);
	type Row = (typeof data.projects)[number];
</script>

<svelte:head><title>Proyek · PM Workspace</title></svelte:head>

<header class="halaman-kepala">
	<div>
		<h1>Proyek</h1>
		<p>Kesehatan semua proyek per {date(data.today)}. Yang paling butuh perhatian di atas.</p>
	</div>
</header>

{#if data.projects.length === 0}
	<div class="kosong-blok">
		<FolderKanban size={20} strokeWidth={1.5} aria-hidden="true" />
		<strong>Belum ada proyek</strong>
		<p>Proyek dibuat otomatis saat prospek berstatus Deal, dari versi estimasi yang sudah final.</p>
		<a class="btn" href="/prospek">Lihat prospek</a>
	</div>
{:else}
	<section class="panel ringkas" aria-label="Ringkasan proyek aktif">
		{#each [...HEALTHS].reverse() as h (h)}
			<div class="sel">
				<span class="sel-label"><span class="titik {HEALTH_BADGE[h]}" aria-hidden="true"></span>{HEALTH_LABEL[h]}</span>
				<strong>{count(h)}</strong>
			</div>
		{/each}
		<div class="sel">
			<span class="sel-label">Risiko tinggi</span>
			<strong class:kritis-teks={sum('highRisks') > 0}>{sum('highRisks')}</strong>
		</div>
		<div class="sel">
			<span class="sel-label">Blocker</span>
			<strong class:waspada-teks={sum('blockers') > 0}>{sum('blockers')}</strong>
		</div>
		<div class="sel">
			<span class="sel-label">CR menunggu</span>
			<strong class:waspada-teks={sum('pendingCr') > 0}>{sum('pendingCr')}</strong>
		</div>
	</section>

	{#snippet card(p: Row)}
		<a class="panel kartu" class:nonaktif={p.status !== 'aktif'} href="/proyek/{p.id}">
			<div class="kartu-kepala">
				<div class="judul">
					<strong>{p.name}</strong>
					{#if p.client}<span class="klien">{p.client}</span>{/if}
				</div>
				{#if p.status === 'aktif'}
					<span class="badge {HEALTH_BADGE[p.health]}">{HEALTH_LABEL[p.health]}</span>
				{:else}
					<span class="badge">{STATUS[p.status]}</span>
				{/if}
			</div>

			{#if p.status === 'aktif' && (p.health !== 'hijau' || p.manual) && p.reasons.length}
				<p class="alasan {HEALTH_BADGE[p.health]}">
					{p.reasons[0]}{p.reasons.length > 1 ? ` (+${p.reasons.length - 1} lainnya)` : ''}
				</p>
			{/if}

			<div class="progres">
				{#if p.startDate > data.today}
					<div class="progres-baris"><span class="label">Progres</span><span class="redup">mulai {date(p.startDate)}</span></div>
					<span class="bar" aria-hidden="true"></span>
				{:else}
					<div class="progres-baris">
						<span class="label">Progres</span>
						<span><strong>{decimal(p.overall, 0)}%</strong> <span class="redup">· rencana {decimal(p.expected, 0)}%</span></span>
					</div>
					<span class="bar" aria-hidden="true">
						<span class="isi" style:width="{p.overall}%"></span>
						<span class="rencana" style:left="{p.expected}%"></span>
					</span>
				{/if}
			</div>

			<dl class="fakta">
				<div>
					<dt>Sprint</dt>
					<dd>{p.currentSprint} / {p.totalSprints}</dd>
				</div>
				<div>
					<dt>Proyeksi selesai</dt>
					<dd>
						{date(p.plannedEnd)}
						{#if p.slipDays > 0}<span class="waspada-teks">+{p.slipDays} hari</span>{/if}
					</dd>
				</div>
				<div>
					<dt>Tenggat terdekat</dt>
					<dd>{#if p.nextDue}{p.nextDue.kind === 'milestone' ? '◆ ' : ''}{p.nextDue.name} <span class="redup">· {date(p.nextDue.date)}</span>{:else}<span class="redup">—</span>{/if}</dd>
				</div>
				<div>
					<dt>Perlu perhatian</dt>
					<dd class="perhatian">
						{#if p.highRisks}<span class="kritis-teks">{p.highRisks} risiko tinggi</span>{/if}
						{#if p.blockers}<span class="waspada-teks">{p.blockers} blocker</span>{/if}
						{#if p.pendingCr}<span class="waspada-teks">{p.pendingCr} CR menunggu</span>{/if}
						{#if !p.highRisks && !p.blockers && !p.pendingCr}<span class="redup">Tidak ada</span>{/if}
						{#if p.scopePct}<span class="redup">Scope {p.scopePct > 0 ? '+' : '−'}{decimal(Math.abs(p.scopePct), 0)}% dari CR</span>{/if}
					</dd>
				</div>
			</dl>
		</a>
	{/snippet}

	<div class="kartu-grid">
		{#each active as p (p.id)}{@render card(p)}{/each}
	</div>

	{#if inactive.length}
		<h2 class="sub-judul">Selesai dan ditunda</h2>
		<div class="kartu-grid">
			{#each inactive as p (p.id)}{@render card(p)}{/each}
		</div>
	{/if}

	<details class="cara">
		<summary><Info size={14} strokeWidth={1.75} aria-hidden="true" /> Cara status dihitung</summary>
		<p>
			<strong>Merah</strong> bila proyeksi selesai mundur lebih dari 20% atau ada risiko tinggi tanpa mitigasi.
			<strong>Kuning</strong> bila mundur 10–20%, ada fitur/aktivitas terlambat, progres lebih dari 15 poin di bawah rencana, atau ada
			blocker (isu terbuka) lebih dari 2 hari. Garis tegak pada bilah progres menandai posisi rencana hari ini. PM dapat menetapkan
			status manual dari halaman proyek.
		</p>
	</details>
{/if}

<style>
	.ringkas {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		margin-bottom: var(--jarak-6);
	}
	.sel {
		display: grid;
		gap: var(--jarak-1);
		padding: var(--jarak-4) var(--jarak-6);
		border-right: 1px solid var(--garis);
	}
	.sel:last-child {
		border-right: 0;
	}
	.sel-label {
		display: inline-flex;
		align-items: center;
		gap: var(--jarak-2);
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
		white-space: nowrap;
	}
	.sel strong {
		font-size: var(--teks-h2);
		font-weight: 600;
		line-height: 1.2;
		font-variant-numeric: tabular-nums;
	}
	.titik {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}
	.titik.aman { background: var(--aman); }
	.titik.waspada { background: var(--waspada-ikon); }
	.titik.kritis { background: var(--kritis); }
	@media (max-width: 760px) {
		.ringkas {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		.sel:nth-child(3n) {
			border-right: 0;
		}
		.sel:nth-child(-n + 3) {
			border-bottom: 1px solid var(--garis);
		}
		.sel {
			padding: var(--jarak-3) var(--jarak-4);
		}
	}
	.kartu-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
		gap: var(--jarak-4);
	}
	.kartu {
		display: grid;
		gap: var(--jarak-4);
		align-content: start;
		padding: var(--jarak-6);
		color: var(--tinta);
		text-decoration: none;
		transition: border-color var(--transisi), box-shadow var(--transisi);
	}
	.kartu:hover {
		border-color: var(--nila-sedang);
		box-shadow: 0 2px 10px rgba(28, 34, 48, 0.06);
	}
	.kartu:focus-visible {
		outline: 2px solid var(--nila);
		outline-offset: 2px;
	}
	.kartu.nonaktif {
		opacity: 0.7;
	}
	.kartu-kepala {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--jarak-3);
	}
	.judul {
		display: grid;
		min-width: 0;
	}
	.judul strong {
		font-size: var(--teks-h3);
		font-weight: 600;
		line-height: 1.3;
	}
	.kartu:hover .judul strong {
		color: var(--nila);
	}
	.klien {
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.alasan {
		margin: 0;
		padding: var(--jarak-2) var(--jarak-3);
		border-radius: var(--radius-kecil);
		font-size: var(--teks-kecil);
	}
	.alasan.waspada { background: var(--waspada-tipis); color: var(--waspada); }
	.alasan.kritis { background: var(--kritis-tipis); color: var(--kritis); }
	.alasan.aman { background: var(--aman-tipis); color: var(--aman); }
	.progres {
		display: grid;
		gap: var(--jarak-2);
	}
	.progres-baris {
		display: flex;
		justify-content: space-between;
		font-size: var(--teks-kecil);
	}
	.progres-baris strong {
		font-variant-numeric: tabular-nums;
	}
	.label,
	dt {
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.bar {
		position: relative;
		display: block;
		height: 8px;
		border-radius: 4px;
		background: var(--nila-tipis);
	}
	.bar .isi {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: 4px;
		background: var(--nila);
	}
	/* Posisi rencana hari ini. */
	.bar .rencana {
		position: absolute;
		top: -3px;
		bottom: -3px;
		width: 2px;
		margin-left: -1px;
		border-radius: 1px;
		background: var(--tinta);
	}
	.fakta {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--jarak-3) var(--jarak-4);
		align-items: start;
		margin: 0;
		padding-top: var(--jarak-4);
		border-top: 1px solid var(--garis);
	}
	.fakta div {
		display: grid;
		align-content: start;
		gap: 2px;
		min-width: 0;
	}
	dd {
		margin: 0;
		font-size: var(--teks-isi);
		font-variant-numeric: tabular-nums;
		overflow-wrap: anywhere;
	}
	.perhatian {
		display: grid;
		font-size: var(--teks-kecil);
	}
	.sub-judul {
		margin: var(--jarak-8) 0 var(--jarak-3);
		font-size: var(--teks-isi);
		color: var(--tinta-2);
	}
	.cara {
		margin-top: var(--jarak-8);
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.cara summary {
		display: inline-flex;
		align-items: center;
		gap: var(--jarak-2);
		cursor: pointer;
	}
	.cara p {
		max-width: 72ch;
		margin: var(--jarak-2) 0 0;
	}
	.redup {
		color: var(--tinta-2);
	}
	.waspada-teks {
		color: var(--waspada);
	}
	.kritis-teks {
		color: var(--kritis);
		font-weight: 600;
	}
</style>
