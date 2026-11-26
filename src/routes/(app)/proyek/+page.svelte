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
	{#if active.length}
		<section class="panel ringkas" aria-label="Ringkasan proyek aktif">
			<div>
				<span class="label">Proyek aktif</span>
				<strong>{active.length}</strong>
			</div>
			{#each [...HEALTHS].reverse() as h (h)}
				<div>
					<span class="label"><span class="badge {HEALTH_BADGE[h]}">{HEALTH_LABEL[h]}</span></span>
					<strong>{count(h)}</strong>
				</div>
			{/each}
			<div>
				<span class="label">Risiko tinggi terbuka</span>
				<strong>{active.reduce((a, p) => a + p.highRisks, 0)}</strong>
			</div>
			<div>
				<span class="label">Blocker aktif</span>
				<strong>{active.reduce((a, p) => a + p.blockers, 0)}</strong>
			</div>
			<div>
				<span class="label">CR menunggu keputusan</span>
				<strong>{active.reduce((a, p) => a + p.pendingCr, 0)}</strong>
			</div>
		</section>
	{/if}

	<div class="tabel-wadah">
		<table>
			<thead>
				<tr>
					<th>Proyek</th>
					<th>Status</th>
					<th>Progres</th>
					<th class="angka">Sprint</th>
					<th>Selesai (rencana)</th>
					<th class="angka">Risiko tinggi</th>
					<th class="angka">Blocker</th>
					<th>Change request</th>
					<th>Tenggat terdekat</th>
				</tr>
			</thead>
			<tbody>
				{#each data.projects as p (p.id)}
					<tr class:nonaktif={p.status !== 'aktif'}>
						<td class="nama">
							<a href="/proyek/{p.id}">{p.name}</a>
							<span class="sub">{[p.client, p.status !== 'aktif' ? STATUS[p.status] : ''].filter(Boolean).join(' · ')}</span>
						</td>
						<td class="status">
							<span class="badge {HEALTH_BADGE[p.health]}">{HEALTH_LABEL[p.health]}{p.manual ? ' · manual' : ''}</span>
							<span class="sub" title={p.reasons.join('\n')}>{p.reasons[0] ?? 'Sesuai rencana'}{p.reasons.length > 1 ? ` (+${p.reasons.length - 1})` : ''}</span>
						</td>
						<td class="progres">
							{#if p.startDate > data.today}
								<span class="sub">mulai {date(p.startDate)}</span>
							{:else}
								<div class="bar" aria-hidden="true">
									<span class="isi" style:width="{p.overall}%"></span>
									<span class="rencana" style:left="{p.expected}%"></span>
								</div>
								<span class="sub"><strong>{decimal(p.overall, 0)}%</strong> · rencana {decimal(p.expected, 0)}%</span>
							{/if}
						</td>
						<td class="angka">{p.currentSprint}/{p.totalSprints}</td>
						<td>
							{date(p.plannedEnd)}
							{#if p.slipDays > 0}<span class="sub waspada-teks">+{p.slipDays} hari</span>{/if}
						</td>
						<td class="angka" class:kritis-teks={p.highRisks > 0}>{p.highRisks}</td>
						<td class="angka" class:waspada-teks={p.blockers > 0}>{p.blockers}</td>
						<td class="nowrap">
							{#if p.pendingCr}<span class="waspada-teks">{p.pendingCr} menunggu</span>{/if}
							<span class="sub">{p.scopePct ? `${p.scopePct > 0 ? '+' : '−'}${decimal(Math.abs(p.scopePct), 1)}% effort dari baseline` : p.pendingCr ? '' : '—'}</span>
						</td>
						<td>
							{#if p.nextDue}
								{p.nextDue.name}
								<span class="sub">{p.nextDue.kind === 'milestone' ? 'Milestone · ' : ''}{date(p.nextDue.date)}</span>
							{:else}
								<span class="sub">—</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="catatan">Status otomatis: Merah bila selesai mundur &gt; 20% atau ada risiko tinggi tanpa mitigasi; Kuning bila mundur 10–20%, ada yang terlambat, progres &gt; 15 poin di bawah rencana, atau blocker (isu terbuka) &gt; 2 hari. Garis tipis pada bar progres = rencana hari ini.</p>
{/if}

<style>
	.ringkas {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		margin-bottom: var(--jarak-6);
	}
	.ringkas > div {
		display: grid;
		gap: var(--jarak-1);
		padding: var(--jarak-4) var(--jarak-6);
		border-right: 1px solid var(--garis);
	}
	.ringkas > div:last-child {
		border-right: 0;
	}
	.ringkas strong {
		font-size: var(--teks-h2);
		font-variant-numeric: tabular-nums;
	}
	.label {
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	tbody tr {
		position: relative;
	}
	tr.nonaktif {
		opacity: 0.65;
	}
	.nama a {
		color: var(--tinta);
		font-weight: 500;
		text-decoration: none;
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
	.status .sub {
		max-width: 260px;
		margin-top: 2px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.progres {
		min-width: 140px;
	}
	.bar {
		position: relative;
		height: 6px;
		margin: 4px 0;
		border-radius: 3px;
		background: var(--garis);
	}
	.bar .isi {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: 3px;
		background: var(--nila);
	}
	.bar .rencana {
		position: absolute;
		top: -3px;
		bottom: -3px;
		width: 0;
		border-left: 2px dashed var(--tinta-2);
	}
	.nowrap {
		white-space: nowrap;
	}
	.waspada-teks {
		color: var(--waspada);
	}
	.kritis-teks {
		color: var(--kritis);
		font-weight: 500;
	}
	.catatan {
		margin-top: var(--jarak-4);
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	@media (max-width: 900px) {
		.ringkas {
			grid-template-columns: repeat(3, 1fr);
		}
	}
</style>
