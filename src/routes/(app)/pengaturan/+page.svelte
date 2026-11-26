<script lang="ts">
	import { enhance } from '$app/forms';
	import { ChevronDown, Plus, Users, X } from '@lucide/svelte';
	import { withToast } from '#lib/components/enhance.ts';
	import { date, rupiah } from '#lib/format/index.ts';
	import { LEVEL_LABEL, LEVELS, SOURCE_LABEL, SOURCES } from '#lib/labels.ts';
	import PengaturanNav from './PengaturanNav.svelte';
	import SettingsForm from './SettingsForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let editingId: number | null = $state(null);
	let adding = $state(false);

	/** Error validasi untuk action tertentu (dan peran tertentu, bila ada). */
	function errorsFor(action: string, id?: number): Record<string, string> {
		if (!form || !('action' in form) || form.action !== action) return {};
		if (id !== undefined && (!('id' in form) || form.id !== id)) return {};
		return form.errors ?? {};
	}

	let createErrors = $derived(errorsFor('createRole'));
	let activeCount = $derived(data.roles.filter((r) => r.active).length);
</script>

<svelte:head><title>Pengaturan · PM Workspace</title></svelte:head>

<header class="halaman-kepala">
	<div>
		<h1>Pengaturan</h1>
		<p>Peran, rate, parameter default, dan kalender libur.</p>
	</div>
</header>

<PengaturanNav />

<section aria-labelledby="peran-judul">
	<div class="bagian-kepala">
		<div>
			<h2 id="peran-judul">Peran dan rate</h2>
			<p>
				Rate bulanan per orang. Estimasi menyimpan salinan rate saat dibuat, jadi mengubah rate di sini tidak
				mengubah estimasi lama.
			</p>
		</div>
		{#if data.roles.length > 0 && !adding}
			<button class="btn" onclick={() => (adding = true)}><Plus size={16} strokeWidth={2} aria-hidden="true" /> Tambah peran</button>
		{/if}
	</div>

	{#if data.roles.length === 0 && !adding}
		<div class="kosong-blok">
			<Users size={20} strokeWidth={1.5} aria-hidden="true" />
			<strong>Belum ada peran</strong>
			<p>
				Mulai dengan peran standar (UI/UX, Frontend, Backend, Mobile, QA, DevOps, PM) lalu isi rate-nya, atau
				tambahkan peran sendiri.
			</p>
			<div class="tombol-baris">
				<form novalidate method="POST" action="?/seedRoles" use:enhance={withToast()}>
					<button class="btn">Isi peran standar</button>
				</form>
				<button class="btn teks" onclick={() => (adding = true)}>Tambah peran</button>
			</div>
		</div>
	{/if}

	{#if adding}
		<form
			novalidate
			method="POST"
			action="?/createRole"
			class="panel tambah"
			use:enhance={withToast({ reset: true, onSuccess: () => (adding = false) })}
		>
			<div class="panel-kepala">
				<h3>Peran baru</h3>
				<button type="button" class="btn teks kecil" aria-label="Tutup" onclick={() => (adding = false)}>
					<X size={16} strokeWidth={1.75} />
				</button>
			</div>
			<div class="panel-isi tambah-grid">
				<label class="field nama">
					<span class="field-label">Nama peran</span>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						name="name"
						required
						autofocus
						placeholder="Backend"
						aria-invalid={createErrors.name ? 'true' : undefined}
					/>
					{#if createErrors.name}<span class="field-error">{createErrors.name}</span>{/if}
				</label>
				<label class="field">
					<span class="field-label">Level <span class="opsional">· opsional</span></span>
					<select name="level">
						<option value="">—</option>
						{#each LEVELS as l (l)}<option value={l}>{LEVEL_LABEL[l]}</option>{/each}
					</select>
				</label>
				<label class="field">
					<span class="field-label">Sumber</span>
					<select name="source">
						{#each SOURCES as s (s)}<option value={s}>{SOURCE_LABEL[s]}</option>{/each}
					</select>
				</label>
				<label class="field">
					<span class="field-label">Rate bulanan <span class="opsional">· opsional</span></span>
					<span class="input-grup">
						<span class="affix">Rp</span>
						<input
							name="monthlyRate"
							inputmode="numeric"
							class="angka"
							placeholder="15.000.000"
							aria-invalid={createErrors.monthlyRate ? 'true' : undefined}
						/>
					</span>
					{#if createErrors.monthlyRate}<span class="field-error">{createErrors.monthlyRate}</span>{/if}
				</label>
				<label class="field">
					<span class="field-label">Berlaku sejak</span>
					<input name="effectiveFrom" type="date" value={data.today} required />
				</label>
			</div>
			<div class="form-kaki">
				<button type="button" class="btn teks" onclick={() => (adding = false)}>Batal</button>
				<button class="btn">Simpan peran</button>
			</div>
		</form>
	{/if}

	{#if data.roles.length > 0}
		<div class="tabel-wadah">
			<table>
				<thead>
					<tr>
						<th>Peran</th>
						<th>Level</th>
						<th>Sumber</th>
						<th class="angka">Rate bulanan</th>
						<th>Berlaku sejak</th>
						<th>Status</th>
						<th><span class="sr-only">Aksi</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.roles as role (role.id)}
						{@const editing = editingId === role.id}
						<tr class:nonaktif={!role.active} class:terbuka={editing}>
							<td class="nama-peran">{role.name}</td>
							<td>{role.level ? LEVEL_LABEL[role.level] : '—'}</td>
							<td>{SOURCE_LABEL[role.source]}</td>
							<td class="angka">
								{#if role.currentRate}
									{rupiah(role.currentRate.monthlyRate)}
								{:else}
									<span class="badge waspada">Belum diisi</span>
								{/if}
								{#if role.upcomingRate}
									<span class="berikut">{rupiah(role.upcomingRate.monthlyRate)} mulai {date(role.upcomingRate.effectiveFrom)}</span>
								{/if}
							</td>
							<td class="redup">{role.currentRate ? date(role.currentRate.effectiveFrom) : '—'}</td>
							<td>
								{#if role.active}
									<span class="badge aman">Aktif</span>
								{:else}
									<span class="badge draft">Nonaktif</span>
								{/if}
							</td>
							<td class="aksi-sel">
								<button
									class="btn teks kecil"
									aria-expanded={editing}
									aria-controls="ubah-{role.id}"
									onclick={() => (editingId = editing ? null : role.id)}
								>
									{editing ? 'Tutup' : 'Ubah'}
									<span class="chevron" class:putar={editing}><ChevronDown size={14} strokeWidth={2} aria-hidden="true" /></span>
								</button>
							</td>
						</tr>
						{#if editing}
							{@const roleErr = errorsFor('updateRole', role.id)}
							{@const rateErr = errorsFor('setRate', role.id)}
							<tr class="panel-ubah" id="ubah-{role.id}">
								<td colspan="7">
									<div class="ubah-isi">
										<form novalidate method="POST" action="?/updateRole" use:enhance={withToast()} class="blok">
											<h4>Data peran</h4>
											<input type="hidden" name="id" value={role.id} />
											<label class="field">
												<span class="field-label">Nama peran</span>
												<input name="name" value={role.name} required aria-invalid={roleErr.name ? 'true' : undefined} />
												{#if roleErr.name}<span class="field-error">{roleErr.name}</span>{/if}
											</label>
											<div class="dua">
												<label class="field">
													<span class="field-label">Level</span>
													<select name="level" value={role.level ?? ''}>
														<option value="">—</option>
														{#each LEVELS as l (l)}<option value={l}>{LEVEL_LABEL[l]}</option>{/each}
													</select>
												</label>
												<label class="field">
													<span class="field-label">Sumber</span>
													<select name="source" value={role.source}>
														{#each SOURCES as s (s)}<option value={s}>{SOURCE_LABEL[s]}</option>{/each}
													</select>
												</label>
											</div>
											<button class="btn">Simpan peran</button>
										</form>

										<div class="blok">
											<h4>Rate</h4>
											<form novalidate method="POST" action="?/setRate" use:enhance={withToast({ reset: true })} class="blok">
												<input type="hidden" name="id" value={role.id} />
												<div class="dua">
													<label class="field">
														<span class="field-label">Rate bulanan</span>
														<span class="input-grup">
															<span class="affix">Rp</span>
															<input
																name="monthlyRate"
																inputmode="numeric"
																class="angka"
																placeholder="15.000.000"
																required
																aria-invalid={rateErr.monthlyRate ? 'true' : undefined}
															/>
														</span>
													</label>
													<label class="field">
														<span class="field-label">Berlaku sejak</span>
														<input name="effectiveFrom" type="date" value={data.today} required />
													</label>
												</div>
												{#if rateErr.monthlyRate || rateErr.effectiveFrom}
													<span class="field-error">{rateErr.monthlyRate ?? rateErr.effectiveFrom}</span>
												{:else}
													<span class="field-hint">Tanggal yang sama menimpa rate sebelumnya; tanggal ke depan berlaku otomatis.</span>
												{/if}
												<button class="btn">Simpan rate</button>
											</form>

											{#if role.rates.length > 0}
												<ul class="riwayat" aria-label="Riwayat rate">
													{#each role.rates as rate (rate.id)}
														<li>
															<span class="angka">{rupiah(rate.monthlyRate)}</span>
															<span class="tgl">sejak {date(rate.effectiveFrom)}</span>
															<form novalidate method="POST" action="?/deleteRate" use:enhance={withToast()}>
																<input type="hidden" name="rateId" value={rate.id} />
																<button
																	class="btn teks kecil"
																	aria-label="Hapus rate {rupiah(rate.monthlyRate)} sejak {date(rate.effectiveFrom)}"
																>
																	Hapus
																</button>
															</form>
														</li>
													{/each}
												</ul>
											{/if}
										</div>

										<form novalidate method="POST" action="?/setActive" use:enhance={withToast()} class="blok">
											<h4>Status</h4>
											<input type="hidden" name="id" value={role.id} />
											<input type="hidden" name="active" value={String(!role.active)} />
											<p class="field-hint">
												{role.active
													? 'Peran nonaktif tidak muncul di estimasi baru, tetapi tetap tampil di estimasi lama.'
													: 'Aktifkan agar peran bisa dipilih lagi di estimasi baru.'}
											</p>
											<button class="btn">{role.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
										</form>
									</div>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
		<p class="catatan-bawah">{activeCount} peran aktif dari {data.roles.length}</p>
	{/if}
</section>

<section aria-labelledby="parameter-judul">
	<div class="bagian-kepala">
		<div>
			<h2 id="parameter-judul">Parameter default</h2>
			<p>Terisi otomatis saat membuat estimasi baru, dan bisa diubah per estimasi.</p>
		</div>
	</div>
	<SettingsForm settings={data.settings} errors={errorsFor('saveSettings')} />
</section>

<style>
	section + section {
		margin-top: var(--jarak-12);
	}
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
	.nama-peran {
		font-weight: 500;
	}
	tr.nonaktif td {
		color: var(--tinta-2);
	}
	tr.terbuka td {
		background: color-mix(in srgb, var(--nila-tipis) 50%, transparent);
	}
	.redup {
		color: var(--tinta-2);
	}
	.berikut {
		display: block;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.aksi-sel {
		text-align: right;
		width: 1%;
		white-space: nowrap;
	}
	.chevron {
		display: inline-flex;
		transition: transform var(--transisi);
	}
	.chevron.putar {
		transform: rotate(180deg);
	}
	tr.panel-ubah:hover {
		background: none;
	}
	tr.panel-ubah td {
		padding: 0;
		background: color-mix(in srgb, var(--kertas) 55%, var(--permukaan));
		border-bottom: 1px solid var(--garis);
	}
	.ubah-isi {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: var(--jarak-8);
		padding: var(--jarak-6);
	}
	.blok {
		display: grid;
		gap: var(--jarak-3);
		align-content: start;
	}
	.blok > .btn {
		justify-self: start;
	}
	h4 {
		margin: 0;
		font-size: var(--teks-kecil);
		font-weight: 600;
	}
	.dua {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--jarak-3);
	}
	.riwayat {
		list-style: none;
		margin: var(--jarak-2) 0 0;
		padding: 0;
		font-size: var(--teks-kecil);
		border-top: 1px solid var(--garis);
	}
	.riwayat li {
		display: flex;
		align-items: center;
		gap: var(--jarak-3);
		min-height: 40px;
		border-bottom: 1px solid var(--garis);
	}
	.riwayat .tgl {
		color: var(--tinta-2);
		margin-right: auto;
	}
	.catatan-bawah {
		margin: var(--jarak-3) 0 0;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.tambah {
		margin-bottom: var(--jarak-6);
	}
	.tambah-grid {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr 1.5fr 1.2fr;
		gap: var(--jarak-4);
		align-items: start;
	}
	@container (max-width: 900px) {
		.tambah-grid {
			grid-template-columns: 1fr 1fr;
		}
		.tambah-grid .nama {
			grid-column: 1 / -1;
		}
	}
	.tombol-baris {
		display: flex;
		gap: var(--jarak-2);
		align-items: center;
	}
</style>
