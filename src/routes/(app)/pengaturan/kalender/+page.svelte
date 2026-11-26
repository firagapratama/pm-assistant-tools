<script lang="ts">
	import { enhance } from '$app/forms';
	import { CalendarDays, Plus, Trash2 } from '@lucide/svelte';
	import { isWeekday } from '#lib/calc/calendar.ts';
	import { withToast } from '#lib/components/enhance.ts';
	import PengaturanNav from '../PengaturanNav.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const TYPE_LABEL = { nasional: 'Libur nasional', cuti_bersama: 'Cuti bersama' } as const;
	const thisYear = new Date().getFullYear();

	let years = $derived(
		[...new Set([...data.holidays.map((h) => Number(h.date.slice(0, 4))), thisYear, thisYear + 1])].sort((a, b) => a - b)
	);
	// svelte-ignore state_referenced_locally — tahun awal: tahun depan bila sudah ada datanya, kalau tidak tahun ini.
	let year = $state(data.holidays.some((h) => h.date.startsWith(String(thisYear + 1))) ? thisYear + 1 : thisYear);
	let rows = $derived(data.holidays.filter((h) => h.date.startsWith(String(year))));
	let weekdayCount = $derived(rows.filter((h) => isWeekday(h.date)).length);
	let adding = $state(false);

	let errors: Record<string, string> = $derived(form && 'action' in form && form.action === 'save' ? form.errors : {});
	let values: Record<string, string> = $derived(form && 'values' in form && form.values ? form.values : {});

	const dayFmt = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'UTC' });
	const dateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', timeZone: 'UTC' });
	const asDate = (iso: string) => new Date(iso + 'T00:00:00Z');
</script>

<svelte:head><title>Kalender libur · PM Workspace</title></svelte:head>

<header class="halaman-kepala">
	<div>
		<h1>Pengaturan</h1>
		<p>Peran, rate, parameter default, dan kalender libur.</p>
	</div>
</header>

<PengaturanNav />

<div class="bagian-kepala">
	<div>
		<h2>Kalender libur</h2>
		<p>
			Libur nasional dan cuti bersama mengurangi hari kerja di sprint yang terkena, bila estimasi punya rencana mulai.
			Libur yang jatuh di akhir pekan tidak mengurangi kapasitas.
		</p>
	</div>
	{#if !adding}
		<button class="btn" onclick={() => (adding = true)}><Plus size={16} strokeWidth={2} aria-hidden="true" /> Tambah libur</button>
	{/if}
</div>

{#if data.missingOfficial.length > 0}
	<div class="info muat">
		<span>
			Daftar resmi SKB 3 Menteri {data.missingOfficial.join(' dan ')} belum lengkap di kalender.
		</span>
		<form novalidate method="POST" action="?/loadOfficial" use:enhance={withToast()}>
			<button class="btn kecil">Muat daftar resmi</button>
		</form>
	</div>
{/if}

{#if adding}
	<form
		novalidate
		method="POST"
		action="?/save"
		class="panel tambah"
		use:enhance={withToast({ reset: true, onSuccess: () => (adding = false) })}
	>
		<div class="panel-isi tambah-grid">
			<label class="field">
				<span class="field-label">Tanggal</span>
				<input type="date" name="date" value={values.date ?? ''} aria-invalid={errors.date ? 'true' : undefined} />
				{#if errors.date}<span class="field-error">{errors.date}</span>{/if}
			</label>
			<label class="field">
				<span class="field-label">Nama</span>
				<input name="name" value={values.name ?? ''} placeholder="Misalnya: Cuti bersama Idulfitri" aria-invalid={errors.name ? 'true' : undefined} />
				{#if errors.name}<span class="field-error">{errors.name}</span>{/if}
			</label>
			<label class="field">
				<span class="field-label">Jenis</span>
				<select name="type" value={values.type ?? 'nasional'}>
					<option value="nasional">Libur nasional</option>
					<option value="cuti_bersama">Cuti bersama</option>
				</select>
			</label>
		</div>
		<div class="form-kaki">
			<span class="field-hint">Tanggal yang sudah ada akan diperbarui nama dan jenisnya.</span>
			<button type="button" class="btn teks" onclick={() => (adding = false)}>Batal</button>
			<button class="btn">Simpan libur</button>
		</div>
	</form>
{/if}

<div class="alat">
	<nav class="tahun" aria-label="Tahun">
		{#each years as y (y)}
			<button aria-current={y === year ? 'true' : undefined} onclick={() => (year = y)}>{y}</button>
		{/each}
	</nav>
	{#if rows.length > 0}
		<p class="ringkas">
			{rows.filter((h) => h.type === 'nasional').length} libur nasional · {rows.filter((h) => h.type === 'cuti_bersama').length} cuti
			bersama · <strong>{weekdayCount} jatuh di hari kerja</strong>
		</p>
	{/if}
</div>

{#if rows.length === 0}
	<div class="kosong-blok">
		<CalendarDays size={20} strokeWidth={1.5} aria-hidden="true" />
		<strong>Belum ada libur di {year}</strong>
		<p>
			{#if data.officialYears.includes(year)}
				Muat daftar resmi SKB 3 Menteri, atau tambahkan tanggal satu per satu.
			{:else}
				SKB libur nasional dan cuti bersama biasanya terbit sekitar September tahun sebelumnya. Tambahkan tanggalnya di sini
				setelah terbit.
			{/if}
		</p>
	</div>
{:else}
	<div class="tabel-wadah">
		<table>
			<thead>
				<tr>
					<th>Tanggal</th>
					<th>Hari</th>
					<th>Nama</th>
					<th>Jenis</th>
					<th><span class="sr-only">Aksi</span></th>
				</tr>
			</thead>
			<tbody>
				{#each rows as h (h.date)}
					{@const weekend = !isWeekday(h.date)}
					<tr class:akhir-pekan={weekend}>
						<td class="tgl">{dateFmt.format(asDate(h.date))}</td>
						<td>
							{dayFmt.format(asDate(h.date))}
							{#if weekend}<span class="catatan-kecil">akhir pekan</span>{/if}
						</td>
						<td>{h.name}</td>
						<td><span class="badge" class:final={h.type === 'nasional'}>{TYPE_LABEL[h.type]}</span></td>
						<td class="aksi-sel">
							<form novalidate method="POST" action="?/delete" use:enhance={withToast()}>
								<input type="hidden" name="date" value={h.date} />
								<button class="btn teks kecil" aria-label="Hapus {h.name} {dateFmt.format(asDate(h.date))}">
									<Trash2 size={14} strokeWidth={1.75} />
								</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="catatan-bawah">
		Estimasi menyimpan salinan kalender saat dibuat. Setelah mengubah kalender, buka estimasi draf lalu pilih "Ambil rate
		&amp; kalender terbaru" di tab Biaya.
	</p>
{/if}

<style>
	.bagian-kepala {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: var(--jarak-4);
		margin-bottom: var(--jarak-4);
	}
	.bagian-kepala h2 {
		font-size: var(--teks-h3);
	}
	.bagian-kepala p {
		margin: var(--jarak-1) 0 0;
		max-width: 70ch;
		color: var(--tinta-2);
	}
	.muat {
		justify-content: space-between;
		margin-bottom: var(--jarak-4);
	}
	.tambah {
		margin-bottom: var(--jarak-6);
	}
	.tambah-grid {
		display: grid;
		grid-template-columns: 180px 1fr 180px;
		gap: var(--jarak-4);
		align-items: start;
	}
	@container (max-width: 640px) {
		.tambah-grid {
			grid-template-columns: 1fr;
		}
	}
	.alat {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--jarak-4);
		flex-wrap: wrap;
		margin-bottom: var(--jarak-3);
	}
	.tahun {
		display: flex;
		padding: 3px;
		gap: 2px;
		border-radius: var(--radius-kecil);
		background: color-mix(in srgb, var(--kertas), var(--garis) 55%);
	}
	.tahun button {
		height: 32px;
		padding: 0 var(--jarak-4);
		border: 0;
		border-radius: 4px;
		background: none;
		font: inherit;
		font-size: var(--teks-kecil);
		font-weight: 500;
		color: var(--tinta-2);
		cursor: pointer;
		font-variant-numeric: tabular-nums;
	}
	.tahun button[aria-current='true'] {
		background: var(--permukaan);
		color: var(--nila);
		box-shadow: 0 1px 2px rgba(28, 34, 48, 0.08);
	}
	.ringkas {
		margin: 0;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.ringkas strong {
		color: var(--tinta);
		font-weight: 500;
	}
	.tgl {
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
		font-weight: 500;
	}
	tr.akhir-pekan td {
		color: var(--tinta-2);
	}
	.catatan-kecil {
		margin-left: var(--jarak-2);
		font-size: var(--teks-mini);
		color: var(--tinta-2);
	}
	.aksi-sel {
		width: 1%;
		text-align: right;
	}
	.catatan-bawah {
		margin: var(--jarak-3) 0 0;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
</style>
