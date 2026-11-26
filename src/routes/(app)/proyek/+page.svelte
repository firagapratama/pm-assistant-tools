<script lang="ts">
	import { FolderKanban } from '@lucide/svelte';
	import { date, rupiahShort } from '#lib/format/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const STATUS = { aktif: 'Aktif', selesai: 'Selesai', ditunda: 'Ditunda' } as const;
</script>

<svelte:head><title>Proyek · PM Workspace</title></svelte:head>

<header class="halaman-kepala">
	<div>
		<h1>Proyek</h1>
		<p>Proyek yang sudah deal beserta baseline-nya.</p>
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
	<div class="tabel-wadah">
		<table>
			<thead>
				<tr>
					<th>Proyek</th>
					<th>Status</th>
					<th>Mulai</th>
					<th>Selesai (baseline)</th>
					<th class="angka">Sprint</th>
					<th class="angka">Harga baseline</th>
				</tr>
			</thead>
			<tbody>
				{#each data.projects as p (p.id)}
					<tr>
						<td class="nama">
							<a href="/proyek/{p.id}">{p.name}</a>
							{#if p.client}<span class="sub">{p.client}</span>{/if}
						</td>
						<td><span class="badge" class:aman={p.status === 'aktif'}>{STATUS[p.status]}</span></td>
						<td>{date(p.startDate)}</td>
						<td>{date(p.baseline.endDate)}</td>
						<td class="angka">{p.baseline.totalSprints}</td>
						<td class="angka">{rupiahShort(p.baseline.price)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	tbody tr {
		position: relative;
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
</style>
