<script lang="ts">
	import { enhance } from '$app/forms';
	import { withToast } from '#lib/components/enhance.ts';
	import { date, decimal } from '#lib/format/index.ts';
	import PengaturanNav from '../PengaturanNav.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const time = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' });
</script>

<svelte:head><title>Draf AI · Pengaturan · PM Workspace</title></svelte:head>

<header class="halaman-kepala">
	<div>
		<h1>Pengaturan</h1>
		<p>Peran, rate, parameter default, kalender libur, dan draf AI.</p>
	</div>
</header>

<PengaturanNav />

<section class="panel" aria-labelledby="ai-judul">
	<div class="panel-kepala"><h2 id="ai-judul">Draf fitur dengan AI</h2></div>
	<div class="panel-isi isi">
		<dl class="info">
			<dt>Status</dt>
			<dd>
				{#if !data.env}
					<span class="badge">Belum dikonfigurasi</span> Isi <code>AI_API_KEY</code>, <code>AI_BASE_URL</code>, dan <code>AI_MODEL</code> di <code>.env</code>.
				{:else if data.enabled}
					<span class="badge aman">Aktif</span>
				{:else}
					<span class="badge">Dimatikan</span> Tombol AI tidak ditampilkan di editor estimasi.
				{/if}
			</dd>
			{#if data.env}
				<dt>Penyedia</dt>
				<dd>{data.env.provider} · {data.env.model}</dd>
			{/if}
			<dt>Yang dikirim</dt>
			<dd>Nama proyek, kebutuhan, tujuan, catatan, dan nama peran, setelah PM melihat dan boleh mengedit teksnya. Rate, biaya, harga, nama orang, data proyek lain, serta isi RAID dan keputusan tidak pernah dikirim.</dd>
		</dl>
		<p class="field-hint">Sebelum memakai penyedia tertentu, periksa kebijakan retensi data dan pemakaian data untuk pelatihan model penyedia tersebut.</p>
		<form method="POST" action="?/toggle" use:enhance={withToast()}>
			<input type="hidden" name="enabled" value={String(!data.enabled)} />
			<button class="btn">{data.enabled ? 'Matikan draf AI' : 'Nyalakan draf AI'}</button>
		</form>
	</div>
</section>

<section class="log" aria-labelledby="log-judul">
	<h2 id="log-judul">Log pemanggilan</h2>
	<p class="field-hint">30 pemanggilan terakhir. Isi teks tidak disimpan.</p>
	{#if data.calls.length === 0}
		<p class="redup">Belum ada pemanggilan.</p>
	{:else}
		<div class="tabel-wadah">
			<table>
				<thead>
					<tr>
						<th>Waktu</th>
						<th>Penyedia · model</th>
						<th class="angka">Karakter terkirim</th>
						<th>Disamarkan</th>
						<th>Hasil</th>
					</tr>
				</thead>
				<tbody>
					{#each data.calls as c (c.id)}
						<tr>
							<td class="nowrap">{date(c.createdAt.toISOString().slice(0, 10))} {time.format(c.createdAt)}</td>
							<td>{c.provider} · {c.model}</td>
							<td class="angka">{decimal(c.chars, 0)}</td>
							<td>{c.anonymized ? 'Ya' : 'Tidak'}</td>
							<td>{#if c.ok}<span class="badge aman">{c.features} fitur</span>{:else}<span class="badge kritis">Gagal</span>{/if}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<style>
	.isi {
		display: grid;
		gap: var(--jarak-4);
	}
	.info {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: var(--jarak-2) var(--jarak-6);
		margin: 0;
	}
	.info dt {
		color: var(--tinta-2);
		font-size: var(--teks-kecil);
	}
	.info dd {
		margin: 0;
	}
	.log {
		margin-top: var(--jarak-8);
	}
	.log h2 {
		font-size: var(--teks-h3);
	}
	.nowrap {
		white-space: nowrap;
	}
	.redup {
		color: var(--tinta-2);
	}
</style>
