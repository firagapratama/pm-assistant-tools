<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowLeft, Calculator, FolderKanban, Plus, Trash2 } from '@lucide/svelte';
	import { todayIso } from '#lib/format/index.ts';
	import { toast } from '#lib/components/toast.svelte.ts';
	import { withToast } from '#lib/components/enhance.ts';
	import { date, daysAgo, rupiah } from '#lib/format/index.ts';
	import { PROSPECT_STATUSES, STATUS_LABEL, type ProspectStatus } from '#lib/labels.ts';
	import { toFormValues } from '#lib/validation/prospect.ts';
	import ProspectForm from '../ProspectForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let p = $derived(data.prospect);
	let nextStatus: ProspectStatus | '' = $state('');
	let statusErrors: Record<string, string> = $derived(form?.action === 'changeStatus' ? form.errors : {});
	let editErrors: Record<string, string> = $derived(form?.action === 'update' ? form.errors : {});
	let editValues = $derived(form?.action === 'update' && 'values' in form ? form.values : toFormValues(p));
	const options = $derived(PROSPECT_STATUSES.filter((s) => s !== p.status));
	/** Senin berikutnya dari hari ini (YYYY-MM-DD), sebagai saran tanggal mulai. */
	function nextMonday() {
		const d = new Date();
		d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
		return todayIso(d);
	}
	let dealStart = $derived(data.final?.plannedStart ?? nextMonday());
	let confirmingDelete = $state(false);
	/** Versi estimasi yang sedang dikonfirmasi untuk dihapus. */
	let confirmVersion: number | null = $state(null);
	let estimateDeleteError = $derived(form?.action === 'deleteEstimate' ? form.errors._ : undefined);
	let deleting = $state(false);
	let deleteError = $derived(form?.action === 'delete' ? form.errors._ : undefined);
	let canEstimate = $derived(p.status !== 'deal' && p.status !== 'batal');
	let estimateError = $derived(form?.action === 'createEstimate' ? form.errors._ : undefined);
	let meta = $derived([p.client, `Dicatat ${date(p.createdAt)}`].filter(Boolean).join(' · '));
</script>

<svelte:head><title>{p.name} · PM Workspace</title></svelte:head>

<a class="kembali" href="/prospek"><ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" /> Prospek</a>

<header class="halaman-kepala">
	<div>
		<div class="judul">
			<h1>{p.name}</h1>
			<span class="badge" class:final={p.status === 'deal'}>{STATUS_LABEL[p.status]}</span>
		</div>
		<p>{meta}</p>
	</div>
</header>

{#if p.status === 'batal' && p.cancelReason}
	<p class="pesan-batal"><strong>Alasan batal</strong> {p.cancelReason}</p>
{/if}

<div class="dua-kolom">
	<div class="utama">
		<section aria-labelledby="estimasi-judul">
			<div class="judul-baris">
				<h2 id="estimasi-judul" class="judul-bagian">Estimasi</h2>
				{#if data.estimates.length > 0 && canEstimate}
					<form novalidate method="POST" action="?/createEstimate" use:enhance={withToast()}>
						<button class="btn kecil"><Plus size={14} strokeWidth={2} aria-hidden="true" /> Versi baru</button>
					</form>
				{/if}
			</div>
			{#if estimateError || estimateDeleteError}<p class="pesan-error" role="alert">{estimateError ?? estimateDeleteError}</p>{/if}
			{#if data.estimates.length === 0}
				<div class="kosong-blok">
					<Calculator size={20} strokeWidth={1.5} aria-hidden="true" />
					<strong>Belum ada estimasi</strong>
					<p>Pecah kebutuhan menjadi fitur, isi estimasi O/M/P per peran, lalu lihat durasi dan biayanya.</p>
					{#if canEstimate}
						<form novalidate method="POST" action="?/createEstimate" use:enhance={withToast()}>
							<button class="btn">Buat estimasi</button>
						</form>
					{/if}
				</div>
			{:else}
				<ul class="versi panel">
					{#each data.estimates as e (e.id)}
						{@const protectedBaseline = e.isFinal && p.status === 'deal'}
						{#if confirmVersion === e.version}
							<li class="konfirmasi-versi">
								<div>
									<strong id="hapus-v{e.version}">Hapus versi {e.version}?</strong>
									<span>
										{e.featureCount} fitur, tim, dan biaya di versi ini ikut terhapus permanen.{e.isFinal
											? ' Ini versi final yang mungkin sudah dipresentasikan.'
											: ''}
									</span>
								</div>
								<form
									novalidate
									method="POST"
									action="?/deleteEstimate"
									use:enhance={withToast({ onSuccess: () => (confirmVersion = null) })}
								>
									<input type="hidden" name="version" value={e.version} />
									<!-- svelte-ignore a11y_autofocus -->
									<button type="button" class="btn teks kecil" autofocus onclick={() => (confirmVersion = null)}>Batal</button>
									<button class="btn kecil bahaya">Hapus versi</button>
								</form>
							</li>
						{:else}
							<li>
								<a href="/prospek/{p.id}/estimasi/{e.version}">Versi {e.version}</a>
								{#if e.isFinal}<span class="badge final">Final</span>{:else}<span class="badge draft">Draft</span>{/if}
								<span class="redup">{e.featureCount} fitur · dibuat {date(e.createdAt)}</span>
								{#if !protectedBaseline}
									<button
										class="btn teks kecil hapus-versi"
										aria-label="Hapus versi {e.version}"
										title="Hapus versi {e.version}"
										onclick={() => (confirmVersion = e.version)}
									>
										<Trash2 size={14} strokeWidth={1.75} />
									</button>
								{/if}
							</li>
						{/if}
					{/each}
				</ul>
			{/if}
		</section>

		<section aria-labelledby="data-judul">
			<h2 id="data-judul" class="judul-bagian">Data prospek</h2>
			{#key p}
				<ProspectForm action="?/update" values={editValues} errors={editErrors} clients={data.clients} submit={withToast()}>
					{#snippet actions()}
						<button class="btn primer">Simpan prospek</button>
					{/snippet}
				</ProspectForm>
			{/key}
		</section>
	</div>

	<aside>
		<section class="panel" aria-labelledby="status-judul">
			<div class="panel-kepala"><h2 id="status-judul">Ubah status</h2></div>
			<div class="panel-isi">
				{#if p.status === 'deal'}
					<p class="field-hint">Prospek sudah Deal. Perubahan scope setelah deal dilakukan lewat change request proyek.</p>
					{#if data.projectId}
						<a class="btn" href="/proyek/{data.projectId}"><FolderKanban size={16} strokeWidth={1.75} aria-hidden="true" /> Lihat proyek</a>
					{/if}
				{:else}
					<form
						novalidate
						method="POST"
						action="?/changeStatus"
						class="tumpuk"
						use:enhance={withToast({ reset: true, onSuccess: () => (nextStatus = '') })}
					>
						<label class="field">
							<span class="field-label">Status baru</span>
							<select name="to" bind:value={nextStatus} required>
								<option value="" disabled>Pilih status</option>
								{#each options as s (s)}
									<option value={s} disabled={s === 'deal' && !data.hasFinalEstimate}>
										{STATUS_LABEL[s]}{s === 'deal' && !data.hasFinalEstimate ? ' (butuh estimasi final)' : ''}
									</option>
								{/each}
							</select>
						</label>
						{#if nextStatus === 'deal' && data.final}
							<label class="field">
								<span class="field-label">Tanggal mulai proyek</span>
								<input type="date" name="startDate" value={dealStart} required aria-invalid={statusErrors._ ? 'true' : undefined} />
								<span class="field-hint">
									Proyek dibuat dari estimasi versi {data.final.version} (final) sebagai baseline. Rencana sprint dihitung dari
									tanggal ini, termasuk libur.
								</span>
							</label>
						{/if}
						{#if nextStatus === 'batal'}
							<label class="field">
								<span class="field-label">Alasan batal</span>
								<textarea
									name="cancelReason"
									rows="3"
									required
									placeholder="Misalnya anggaran klien dipotong"
									aria-invalid={statusErrors._ ? 'true' : undefined}
								></textarea>
							</label>
						{/if}
						<label class="field">
							<span class="field-label">Catatan <span class="opsional">· opsional</span></span>
							<textarea name="note" rows="2"></textarea>
						</label>
						{#if statusErrors._ || statusErrors.to}
							<p class="pesan-error" role="alert">{statusErrors._ ?? statusErrors.to}</p>
						{/if}
						<button class="btn" disabled={!nextStatus}>Ubah status</button>
					</form>
				{/if}
			</div>
		</section>

		<section class="panel" aria-labelledby="riwayat-judul">
			<div class="panel-kepala"><h2 id="riwayat-judul">Riwayat status</h2></div>
			<ol class="linimasa">
				{#each data.history as h, i (h.id)}
					<li class:terkini={i === 0}>
						<div class="baris">
							<span>
								{#if h.from}<span class="dari">{STATUS_LABEL[h.from]} →</span>{/if}
								<strong>{STATUS_LABEL[h.to]}</strong>
							</span>
							<time datetime={new Date(h.createdAt).toISOString()} title={date(h.createdAt)}>{daysAgo(h.createdAt)}</time>
						</div>
						{#if h.note}<p class="catatan">{h.note}</p>{/if}
					</li>
				{/each}
			</ol>
		</section>

		{#if p.budget !== null || p.deadline}
			<section class="panel" aria-labelledby="batas-judul">
				<div class="panel-kepala"><h2 id="batas-judul">Batasan klien</h2></div>
				<dl class="panel-isi">
					{#if p.deadline}<dt>Tenggat</dt><dd>{date(p.deadline)}</dd>{/if}
					{#if p.budget !== null}<dt>Batas anggaran</dt><dd class="angka">{rupiah(p.budget)}</dd>{/if}
				</dl>
			</section>
		{/if}
		{#if p.status !== 'deal'}
			<section class="hapus" aria-labelledby="hapus-judul">
				<h2 id="hapus-judul" class="sr-only">Hapus prospek</h2>
				{#if !confirmingDelete}
					<button class="btn teks kecil bahaya-teks" onclick={() => (confirmingDelete = true)}>
						<Trash2 size={14} strokeWidth={1.75} aria-hidden="true" /> Hapus prospek
					</button>
				{:else}
					<div class="konfirmasi" role="alertdialog" aria-labelledby="konfirmasi-judul" aria-describedby="konfirmasi-isi">
						<strong id="konfirmasi-judul">Hapus prospek ini secara permanen?</strong>
						<p id="konfirmasi-isi">
							{p.name} akan dihapus beserta riwayat status{data.deletion.estimates > 0
								? ` dan ${data.deletion.estimates} versi estimasi${data.deletion.finalEstimates > 0 ? ` (termasuk ${data.deletion.finalEstimates} versi final)` : ''}`
								: ''}. Tindakan ini tidak bisa dibatalkan.
						</p>
						{#if p.status !== 'batal'}
							<p class="saran">Jika prospek hanya tidak dilanjutkan, ubah statusnya menjadi Batal agar datanya tetap tersimpan.</p>
						{/if}
						{#if deleteError}<p class="pesan-error" role="alert">{deleteError}</p>{/if}
						<form
							novalidate
							method="POST"
							action="?/delete"
							use:enhance={() => {
								deleting = true;
								return async ({ result, update }) => {
									if (result.type === 'redirect') toast(`"${p.name}" dihapus`);
									await update();
									deleting = false;
								};
							}}
						>
							<button type="button" class="btn teks kecil" onclick={() => (confirmingDelete = false)} disabled={deleting}>Batal</button>
							<button class="btn kecil bahaya" disabled={deleting}>{deleting ? 'Menghapus…' : 'Ya, hapus permanen'}</button>
						</form>
					</div>
				{/if}
			</section>
		{/if}
	</aside>
</div>

<style>
	.judul {
		display: flex;
		align-items: center;
		gap: var(--jarak-3);
		flex-wrap: wrap;
	}
	.pesan-batal {
		display: grid;
		gap: var(--jarak-1);
		max-width: 70ch;
		margin: calc(-1 * var(--jarak-4)) 0 var(--jarak-8);
		padding: var(--jarak-3) var(--jarak-4);
		border-left: 2px solid var(--garis-kuat);
		background: var(--permukaan);
		border-radius: 0 var(--radius-kecil) var(--radius-kecil) 0;
	}
	.pesan-batal strong {
		font-size: var(--teks-kecil);
		font-weight: 500;
		color: var(--tinta-2);
	}
	.dua-kolom {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 320px;
		gap: var(--jarak-8);
		align-items: start;
	}
	.utama {
		display: grid;
		gap: var(--jarak-8);
	}
	aside {
		display: grid;
		gap: var(--jarak-6);
		position: sticky;
		top: var(--jarak-6);
	}
	.judul-bagian {
		font-size: var(--teks-isi);
	}
	.judul-baris {
		display: flex;
		justify-content: space-between;
		align-items: center;
		min-height: 30px;
		margin-bottom: var(--jarak-3);
	}
	.versi {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.versi li {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--jarak-3);
		padding: var(--jarak-3) var(--jarak-6);
		border-bottom: 1px solid var(--garis);
	}
	.versi li:last-child {
		border-bottom: 0;
	}
	.versi li:hover {
		background: color-mix(in srgb, var(--nila-tipis) 50%, transparent);
	}
	.versi a {
		font-weight: 500;
		color: var(--tinta);
		text-decoration: none;
	}
	.versi a::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	.hapus-versi {
		position: relative; /* di atas tautan baris */
		z-index: 1;
		color: var(--tinta-2);
		height: 28px;
	}
	.hapus-versi:hover:not(:disabled) {
		color: var(--kritis);
		background: var(--kritis-tipis);
	}
	.versi li.konfirmasi-versi {
		justify-content: space-between;
		flex-wrap: wrap;
		background: var(--kritis-tipis);
		font-size: var(--teks-kecil);
	}
	.konfirmasi-versi:hover {
		background: var(--kritis-tipis) !important;
	}
	.konfirmasi-versi div {
		display: grid;
		gap: 2px;
	}
	.konfirmasi-versi strong {
		color: var(--kritis);
	}
	.konfirmasi-versi form {
		display: flex;
		gap: var(--jarak-2);
		margin-left: auto;
	}
	.redup {
		margin-left: auto;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.tumpuk {
		display: grid;
		gap: var(--jarak-4);
	}
	.tumpuk .btn {
		justify-self: start;
	}
	.linimasa {
		list-style: none;
		margin: 0;
		padding: var(--jarak-4) var(--jarak-6);
	}
	.linimasa li {
		position: relative;
		padding: 0 0 var(--jarak-4) var(--jarak-6);
		font-size: var(--teks-kecil);
	}
	.linimasa li:last-child {
		padding-bottom: 0;
	}
	/* Titik dan garis linimasa */
	.linimasa li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 6px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--permukaan);
		border: 1.5px solid var(--garis-kuat);
	}
	.linimasa li.terkini::before {
		background: var(--nila);
		border-color: var(--nila);
	}
	.linimasa li:not(:last-child)::after {
		content: '';
		position: absolute;
		left: 4px;
		top: 18px;
		bottom: 2px;
		width: 1px;
		background: var(--garis);
	}
	.baris {
		display: flex;
		justify-content: space-between;
		gap: var(--jarak-2);
	}
	.dari {
		color: var(--tinta-2);
	}
	time {
		color: var(--tinta-2);
		white-space: nowrap;
	}
	.catatan {
		margin: var(--jarak-1) 0 0;
		color: var(--tinta-2);
		white-space: pre-line;
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--jarak-3) var(--jarak-4);
		margin: 0;
	}
	dt {
		color: var(--tinta-2);
		font-size: var(--teks-kecil);
	}
	dd {
		margin: 0;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.hapus {
		padding-top: var(--jarak-2);
	}
	.bahaya-teks {
		color: var(--kritis);
	}
	.bahaya-teks:hover:not(:disabled) {
		background: var(--kritis-tipis);
	}
	.konfirmasi {
		display: grid;
		gap: var(--jarak-3);
		padding: var(--jarak-4);
		border: 1px solid var(--kritis);
		border-radius: var(--radius-panel);
		background: var(--permukaan);
		font-size: var(--teks-kecil);
	}
	.konfirmasi strong {
		color: var(--kritis);
		font-size: var(--teks-isi);
	}
	.konfirmasi p {
		margin: 0;
	}
	.konfirmasi .saran {
		color: var(--tinta-2);
	}
	.konfirmasi form {
		display: flex;
		justify-content: flex-end;
		gap: var(--jarak-2);
	}
	@media (max-width: 1023px) {
		.dua-kolom {
			grid-template-columns: 1fr;
		}
		aside {
			position: static;
		}
	}
</style>
