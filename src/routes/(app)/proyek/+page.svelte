<script lang="ts">
	import { FolderKanban } from '@lucide/svelte';
	import { date, decimal } from '#lib/format/index.ts';
	import { HEALTHS, HEALTH_BADGE, HEALTH_LABEL } from '#lib/project-status.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const STATUS = { aktif: 'Aktif', selesai: 'Selesai', ditunda: 'Ditunda' } as const;
	let active = $derived(data.projects.filter((p) => p.status === 'aktif'));
	const count = (h: (typeof HEALTHS)[number]) => active.filter((p) => p.health === h).length;
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
	<p class="ringkas">
		<span>
			{#each [...HEALTHS].reverse() as h, i (h)}{i ? ' · ' : ''}<strong>{count(h)}</strong> {HEALTH_LABEL[h]}{/each}
			<span class="redup">dari {active.length} proyek aktif</span>
		</span>
		<span class="redup">
			{active.reduce((a, p) => a + p.highRisks, 0)} risiko tinggi · {active.reduce((a, p) => a + p.blockers, 0)} blocker ·
			{active.reduce((a, p) => a + p.pendingCr, 0)} CR menunggu
		</span>
	</p>

	<ul class="daftar">
		{#each data.projects as p (p.id)}
			{@const meta = [
				p.nextDue && `Tenggat: ${p.nextDue.kind === 'milestone' ? '◆ ' : ''}${p.nextDue.name} ${date(p.nextDue.date)}`,
				p.highRisks && `${p.highRisks} risiko tinggi`,
				p.blockers && `${p.blockers} blocker`,
				p.pendingCr && `${p.pendingCr} CR menunggu`,
				p.scopePct && `scope ${p.scopePct > 0 ? '+' : '−'}${decimal(Math.abs(p.scopePct), 0)}% dari CR`
			].filter(Boolean)}
			<li class:nonaktif={p.status !== 'aktif'}>
				<span class="status">
					<span class="badge {HEALTH_BADGE[p.health]}">{HEALTH_LABEL[p.health]}</span>
				</span>
				<span class="nama">
					<a href="/proyek/{p.id}">{p.name}</a>
					<span class="redup">{[p.client, p.status !== 'aktif' ? STATUS[p.status] : ''].filter(Boolean).join(' · ')}</span>
				</span>
				<span class="jadwal">
					<span>Sprint {p.currentSprint}/{p.totalSprints}</span>
					<span class:waspada-teks={p.slipDays > 0}>{p.slipDays > 0 ? `Proyeksi ${date(p.plannedEnd)}` : 'Sesuai rencana'}</span>
				</span>
				<span class="alasan">
					{p.manual ? p.reasons[0] : (p.reasons[0] ?? '—')}{p.reasons.length > 1 ? ` (+${p.reasons.length - 1})` : ''}
					{#if meta.length}<span class="meta">{meta.join(' · ')}</span>{/if}
				</span>
				<span class="progres">
					{#if p.startDate > data.today}
						<span class="redup">mulai {date(p.startDate)}</span>
					{:else}
						<span class="bar" aria-hidden="true">
							<span class="isi" style:width="{p.overall}%"></span>
							<span class="rencana" style:left="{p.expected}%"></span>
						</span>
						<span class="angka-progres"><strong>{decimal(p.overall, 0)}%</strong> <span class="redup">(rencana {decimal(p.expected, 0)}%)</span></span>
					{/if}
				</span>
			</li>
		{/each}
	</ul>
	<p class="catatan">
		Status otomatis: Merah bila proyeksi selesai mundur &gt; 20% atau ada risiko tinggi tanpa mitigasi; Kuning bila mundur 10–20%, ada yang
		terlambat, progres &gt; 15 poin di bawah rencana, atau blocker (isu terbuka) &gt; 2 hari. Garis tegak pada bilah progres = rencana hari ini.
	</p>
{/if}

<style>
	.ringkas {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--jarak-2) var(--jarak-6);
		margin: 0 0 var(--jarak-4);
		padding-bottom: var(--jarak-3);
		border-bottom: 1px solid var(--garis-kuat, var(--garis));
	}
	.ringkas strong {
		font-variant-numeric: tabular-nums;
	}
	.daftar {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.daftar li {
		position: relative;
		display: grid;
		grid-template-columns: 96px minmax(0, 1fr) minmax(260px, auto);
		grid-template-areas: 'status nama jadwal' '. alasan progres';
		gap: var(--jarak-1) var(--jarak-4);
		align-items: baseline;
		padding: var(--jarak-4) var(--jarak-2);
		border-bottom: 1px solid var(--garis);
	}
	.daftar li:hover {
		background: var(--permukaan);
	}
	.daftar li.nonaktif {
		opacity: 0.65;
	}
	.status {
		grid-area: status;
	}
	.nama {
		grid-area: nama;
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--jarak-2);
		align-items: baseline;
	}
	.nama a {
		color: var(--tinta);
		font-weight: 500;
		text-decoration: none;
	}
	/* Seluruh baris dapat diklik (design.md 5.5). */
	.nama a::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	li:hover .nama a {
		color: var(--nila);
	}
	.jadwal {
		grid-area: jadwal;
		display: flex;
		justify-content: space-between;
		gap: var(--jarak-4);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.alasan {
		grid-area: alasan;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.meta {
		display: block;
	}
	.progres {
		grid-area: progres;
		display: flex;
		align-items: center;
		gap: var(--jarak-3);
		font-size: var(--teks-kecil);
		white-space: nowrap;
	}
	.bar {
		position: relative;
		flex: 1;
		min-width: 100px;
		height: 8px;
		border-radius: 2px;
		background: var(--nila-tipis);
	}
	.bar .isi {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: 2px;
		background: var(--nila);
	}
	/* Posisi rencana hari ini: garis tegak 1,5px. */
	.bar .rencana {
		position: absolute;
		top: -3px;
		bottom: -3px;
		width: 1.5px;
		margin-left: -0.75px;
		background: var(--tinta);
	}
	.angka-progres strong {
		font-variant-numeric: tabular-nums;
	}
	.redup {
		color: var(--tinta-2);
		font-size: var(--teks-kecil);
	}
	.waspada-teks {
		color: var(--waspada);
	}
	.catatan {
		margin-top: var(--jarak-4);
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	@media (max-width: 760px) {
		.daftar li {
			grid-template-columns: 1fr;
			grid-template-areas: 'status' 'nama' 'jadwal' 'alasan' 'progres';
		}
	}
</style>
