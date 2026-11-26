<script lang="ts">
	// RAID log (PRD F11): matriks risiko dampak × kemungkinan, filter, dan daftar yang bisa diubah langsung.
	import { ChevronDown, Plus, Trash2, TriangleAlert, X } from '@lucide/svelte';
	import { date } from '#lib/format/index.ts';
	import {
		RAID_STATUS_LABEL,
		RAID_STATUSES,
		RAID_TYPE_LABEL,
		RAID_TYPES,
		isOpen,
		raidScore,
		reviewOverdue,
		severity,
		type RaidStatus,
		type RaidType,
		type Severity
	} from '#lib/raid.ts';

	interface Item {
		id: number;
		type: RaidType;
		description: string;
		owner: string;
		impact: number | null;
		likelihood: number | null;
		mitigation: string;
		reviewDate: string | null;
		status: RaidStatus;
		createdAt: Date;
	}

	let {
		items,
		today,
		post
	}: {
		items: Item[];
		today: string;
		post: (action: string, fields: Record<string, string | number | boolean>) => Promise<Record<string, unknown> | null | undefined>;
	} = $props();

	const SCALE = ['', 'Sangat rendah', 'Rendah', 'Sedang', 'Tinggi', 'Sangat tinggi'];
	const SEVERITY_LABEL: Record<Severity, string> = { tinggi: 'Tinggi', sedang: 'Sedang', rendah: 'Rendah' };

	let typeFilter: RaidType | 'semua' = $state('semua');
	let statusFilter: 'aktif' | 'semua' | 'selesai' = $state('aktif');
	let cell: { impact: number; likelihood: number } | null = $state(null);
	let editing: number | 'baru' | null = $state(null);
	let saving = $state(false);

	let openRisks = $derived(items.filter((r) => r.type === 'risk' && isOpen(r) && r.impact && r.likelihood));
	const countAt = (impact: number, likelihood: number) => openRisks.filter((r) => r.impact === impact && r.likelihood === likelihood).length;

	let rows = $derived(
		items
			.filter((r) => typeFilter === 'semua' || r.type === typeFilter)
			.filter((r) => (statusFilter === 'semua' ? true : statusFilter === 'selesai' ? !isOpen(r) : isOpen(r)))
			.filter((r) => !cell || (r.type === 'risk' && r.impact === cell.impact && r.likelihood === cell.likelihood))
			.toSorted(
				(a, b) =>
					Number(isOpen(b)) - Number(isOpen(a)) ||
					(raidScore(b) ?? b.impact ?? 0) - (raidScore(a) ?? a.impact ?? 0) ||
					b.createdAt.getTime() - a.createdAt.getTime()
			)
	);
	const typeCount = (t: RaidType) => items.filter((r) => r.type === t && isOpen(r)).length;

	/** Isian form (teks) per item yang sedang diubah. */
	let form = $state({ type: 'risk' as RaidType, description: '', owner: '', impact: '', likelihood: '', mitigation: '', reviewDate: '', status: 'terbuka' as RaidStatus });

	function startEdit(r: Item | null) {
		editing = r ? r.id : 'baru';
		form = r
			? {
					type: r.type,
					description: r.description,
					owner: r.owner,
					impact: r.impact ? String(r.impact) : '',
					likelihood: r.likelihood ? String(r.likelihood) : '',
					mitigation: r.mitigation,
					reviewDate: r.reviewDate ?? '',
					status: r.status
				}
			: { type: typeFilter === 'semua' ? 'risk' : typeFilter, description: '', owner: '', impact: '', likelihood: '', mitigation: '', reviewDate: '', status: 'terbuka' };
	}

	async function save() {
		saving = true;
		const res = await post('saveRaid', { ...(typeof editing === 'number' ? { id: editing } : {}), ...form });
		saving = false;
		if (res) editing = null;
	}

	async function remove(id: number) {
		await post('deleteRaid', { id });
		editing = null;
	}

	let formScore = $derived(form.type === 'risk' && form.impact && form.likelihood ? Number(form.impact) * Number(form.likelihood) : null);
</script>

{#snippet editor()}
	<div class="form-raid">
		<div class="baris1">
			<label class="field">
				<span class="field-label">Jenis</span>
				<select bind:value={form.type}>
					{#each RAID_TYPES as t (t)}<option value={t}>{RAID_TYPE_LABEL[t]}</option>{/each}
				</select>
			</label>
			<label class="field pemilik">
				<span class="field-label">Pemilik <span class="opsional">· opsional</span></span>
				<input bind:value={form.owner} placeholder="Nama orang atau tim" />
			</label>
			<label class="field">
				<span class="field-label">Status</span>
				<select bind:value={form.status}>
					{#each RAID_STATUSES as st (st)}<option value={st}>{RAID_STATUS_LABEL[st]}</option>{/each}
				</select>
			</label>
		</div>
		<label class="field">
			<span class="field-label">Deskripsi</span>
			<!-- svelte-ignore a11y_autofocus -->
			<textarea rows="2" bind:value={form.description} autofocus placeholder="Apa yang bisa terjadi / sedang terjadi / diasumsikan / dibutuhkan"></textarea>
		</label>
		<div class="baris2">
			<label class="field">
				<span class="field-label">Dampak</span>
				<select bind:value={form.impact}>
					<option value="">Belum dinilai</option>
					{#each [1, 2, 3, 4, 5] as n (n)}<option value={String(n)}>{n} · {SCALE[n]}</option>{/each}
				</select>
			</label>
			{#if form.type === 'risk'}
				<label class="field">
					<span class="field-label">Kemungkinan</span>
					<select bind:value={form.likelihood}>
						<option value="">Belum dinilai</option>
						{#each [1, 2, 3, 4, 5] as n (n)}<option value={String(n)}>{n} · {SCALE[n]}</option>{/each}
					</select>
				</label>
			{/if}
			<label class="field">
				<span class="field-label">Tinjau ulang <span class="opsional">· opsional</span></span>
				<input type="date" bind:value={form.reviewDate} />
			</label>
			{#if formScore !== null}
				<div class="field skor-pratinjau">
					<span class="field-label">Skor</span>
					<span class="badge {severity(formScore)}">{formScore} · {SEVERITY_LABEL[severity(formScore)!]}</span>
				</div>
			{/if}
		</div>
		<label class="field">
			<span class="field-label">{form.type === 'risk' ? 'Rencana mitigasi' : 'Tindakan'} <span class="opsional">· opsional</span></span>
			<textarea rows="2" bind:value={form.mitigation}></textarea>
		</label>
		<div class="aksi">
			{#if typeof editing === 'number'}
				{@const id = editing}
				<button class="btn kecil bahaya" onclick={() => remove(id)} disabled={saving}><Trash2 size={14} strokeWidth={1.75} aria-hidden="true" /> Hapus</button>
			{/if}
			<span class="ruang"></span>
			<button class="btn teks" onclick={() => (editing = null)} disabled={saving}>Batal</button>
			<button class="btn" onclick={save} disabled={saving || !form.description.trim()}>{saving ? 'Menyimpan…' : 'Simpan'}</button>
		</div>
	</div>
{/snippet}

<div class="raid-tata">
	<section class="panel matriks-panel" aria-labelledby="matriks-judul">
		<div class="panel-kepala"><h2 id="matriks-judul">Matriks risiko</h2></div>
		<div class="panel-isi">
			<div class="matriks" role="grid" aria-label="Jumlah risiko terbuka menurut dampak dan kemungkinan">
				<span class="sumbu-y" aria-hidden="true">Kemungkinan</span>
				{#each [5, 4, 3, 2, 1] as l (l)}
					<span class="tik-y" aria-hidden="true">{l}</span>
					{#each [1, 2, 3, 4, 5] as i (i)}
						{@const n = countAt(i, l)}
						{@const sev = severity(i * l)}
						<button
							class="sel {sev}"
							class:aktif={cell?.impact === i && cell?.likelihood === l}
							class:kosong-sel={n === 0}
							aria-label="Dampak {i}, kemungkinan {l}, skor {i * l} ({sev}): {n} risiko"
							onclick={() => (cell = cell?.impact === i && cell?.likelihood === l ? null : { impact: i, likelihood: l })}
						>
							{n || ''}
						</button>
					{/each}
				{/each}
				<!-- baris sumbu X: dua kolom kosong (label sumbu Y dan angka Y) lalu angka dampak 1–5 -->
				<span class="tik-x" style:grid-column="3" aria-hidden="true">1</span>
				{#each [2, 3, 4, 5] as i (i)}<span class="tik-x" aria-hidden="true">{i}</span>{/each}
				<span class="sumbu-x" aria-hidden="true">Dampak</span>
			</div>
			<p class="legenda">
				<span><i class="kunci rendah"></i>Rendah &lt; 8</span>
				<span><i class="kunci sedang"></i>Sedang 8–14</span>
				<span><i class="kunci tinggi"></i>Tinggi ≥ 15</span>
			</p>
		</div>
	</section>

	<section class="daftar" aria-label="Daftar RAID">
		<div class="alat">
			<div class="chip" role="group" aria-label="Jenis">
				<button aria-pressed={typeFilter === 'semua'} onclick={() => (typeFilter = 'semua')}>Semua</button>
				{#each RAID_TYPES as t (t)}
					<button aria-pressed={typeFilter === t} onclick={() => (typeFilter = t)}>
						{RAID_TYPE_LABEL[t]} <span class="n">{typeCount(t)}</span>
					</button>
				{/each}
			</div>
			<select aria-label="Status" bind:value={statusFilter} class="status-filter">
				<option value="aktif">Terbuka &amp; dipantau</option>
				<option value="selesai">Selesai</option>
				<option value="semua">Semua status</option>
			</select>
			<button class="btn kecil tambah" onclick={() => startEdit(null)}><Plus size={14} strokeWidth={2} aria-hidden="true" /> Tambah item</button>
		</div>

		{#if cell}
			<p class="filter-sel">
				Risiko dengan dampak {cell.impact} × kemungkinan {cell.likelihood}
				<button class="btn teks kecil" onclick={() => (cell = null)}><X size={14} strokeWidth={1.75} aria-hidden="true" /> Hapus filter</button>
			</p>
		{/if}

		{#if editing === 'baru'}
			<div class="panel baru">{@render editor()}</div>
		{/if}

		{#if rows.length === 0}
			<div class="kosong-blok">
				<strong>Tidak ada item</strong>
				<p>{items.length ? 'Tidak ada item yang cocok dengan filter ini.' : 'Catat risiko, asumsi, isu, dan dependensi proyek di sini.'}</p>
			</div>
		{:else}
			<div class="tabel-wadah">
				<table>
					<thead>
						<tr>
							<th>Jenis</th>
							<th>Deskripsi</th>
							<th>Skor</th>
							<th>Tinjau</th>
							<th>Status</th>
							<th><span class="sr-only">Ubah</span></th>
						</tr>
					</thead>
					<tbody>
						{#each rows as r (r.id)}
							{@const score = raidScore(r)}
							{@const sev = severity(score)}
							{@const overdue = reviewOverdue(r, today)}
							<tr class="baris" class:terbuka={editing === r.id} class:selesai={!isOpen(r)}>
								<td class="nowrap kecil redup">{RAID_TYPE_LABEL[r.type]}</td>
								<td class="desk">
									<button class="buka" aria-expanded={editing === r.id} onclick={() => (editing === r.id ? (editing = null) : startEdit(r))}>
										{r.description}
									</button>
									{#if r.owner || r.mitigation}
										<span class="sub">{[r.owner, r.mitigation && (r.type === 'risk' ? `Mitigasi: ${r.mitigation}` : `Tindakan: ${r.mitigation}`)].filter(Boolean).join(' · ')}</span>
									{/if}
								</td>
								<td class="nowrap">
									{#if score !== null && sev}
										<span class="badge {sev}">{score} · {SEVERITY_LABEL[sev]}</span>
									{:else if r.impact}
										<span class="kecil redup">Dampak {r.impact}</span>
									{:else}
										<span class="kecil redup">–</span>
									{/if}
								</td>
								<td class="nowrap kecil">
									{#if r.reviewDate}
										{#if overdue}<span class="lewat"><TriangleAlert size={12} strokeWidth={2} aria-hidden="true" /> {date(r.reviewDate)}</span>{:else}{date(r.reviewDate)}{/if}
									{:else}<span class="redup">–</span>{/if}
								</td>
								<td class="nowrap kecil">{RAID_STATUS_LABEL[r.status]}</td>
								<td class="chev"><span class:putar={editing === r.id}><ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" /></span></td>
							</tr>
							{#if editing === r.id}
								<tr class="panel-ubah"><td colspan="6">{@render editor()}</td></tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</div>

<style>
	.raid-tata {
		display: grid;
		grid-template-columns: 300px minmax(0, 1fr);
		gap: var(--jarak-6);
		align-items: start;
	}
	.matriks-panel h2 {
		font-size: var(--teks-isi);
	}
	.matriks {
		display: grid;
		grid-template-columns: 18px 14px repeat(5, 1fr);
		gap: 3px;
		align-items: center;
	}
	.sumbu-y {
		grid-row: 1 / span 5;
		grid-column: 1;
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		font-size: var(--teks-mini);
		color: var(--tinta-2);
		text-align: center;
	}
	.tik-y,
	.tik-x {
		font-size: var(--teks-mini);
		color: var(--tinta-2);
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	.sumbu-x {
		grid-column: 3 / -1;
		font-size: var(--teks-mini);
		color: var(--tinta-2);
		text-align: center;
	}
	.sel {
		aspect-ratio: 1;
		border: 0;
		border-radius: 4px;
		font: inherit;
		font-weight: 600;
		color: var(--tinta);
		cursor: pointer;
		font-variant-numeric: tabular-nums;
	}
	.sel.rendah { background: var(--aman-tipis); }
	.sel.sedang { background: var(--waspada-tipis); }
	.sel.tinggi { background: var(--kritis-tipis); }
	.sel.kosong-sel { opacity: 0.55; }
	.sel.aktif { outline: 2px solid var(--nila); outline-offset: 1px; }
	.sel:hover { filter: brightness(0.96); }
	.legenda {
		display: flex;
		flex-wrap: wrap;
		gap: var(--jarak-2) var(--jarak-3);
		margin: var(--jarak-4) 0 0;
		font-size: var(--teks-mini);
		color: var(--tinta-2);
	}
	.legenda span {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.kunci {
		width: 10px;
		height: 10px;
		border-radius: 2px;
	}
	.kunci.rendah { background: var(--aman-tipis); border: 1px solid var(--aman); }
	.kunci.sedang { background: var(--waspada-tipis); border: 1px solid var(--waspada-ikon); }
	.kunci.tinggi { background: var(--kritis-tipis); border: 1px solid var(--kritis); }
	.badge.rendah { background: var(--aman-tipis); color: var(--aman); }
	.badge.sedang { background: var(--waspada-tipis); color: var(--waspada); }
	.badge.sedang::before { background: var(--waspada-ikon); }
	.badge.tinggi { background: var(--kritis-tipis); color: var(--kritis); }
	.alat {
		display: flex;
		align-items: center;
		gap: var(--jarak-3);
		flex-wrap: wrap;
		margin-bottom: var(--jarak-3);
	}
	.chip {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		padding: 3px;
		border-radius: var(--radius-kecil);
		background: color-mix(in srgb, var(--kertas), var(--garis) 55%);
	}
	.chip button {
		height: 30px;
		padding: 0 var(--jarak-3);
		border: 0;
		border-radius: 4px;
		background: none;
		font: inherit;
		font-size: var(--teks-kecil);
		font-weight: 500;
		color: var(--tinta-2);
		cursor: pointer;
	}
	.chip button[aria-pressed='true'] {
		background: var(--permukaan);
		color: var(--nila);
		box-shadow: 0 1px 2px rgba(28, 34, 48, 0.08);
	}
	.n {
		color: var(--tinta-2);
		font-weight: 400;
	}
	.status-filter {
		width: auto;
		height: 36px;
		font-size: var(--teks-kecil);
	}
	.tambah {
		margin-left: auto;
	}
	.filter-sel {
		display: flex;
		align-items: center;
		gap: var(--jarak-2);
		margin: 0 0 var(--jarak-3);
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.baru {
		margin-bottom: var(--jarak-4);
	}
	td {
		padding-top: var(--jarak-2);
		padding-bottom: var(--jarak-2);
	}
	tr.baris {
		position: relative;
	}
	.buka {
		display: block;
		width: 100%;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: var(--tinta);
		text-align: left;
		cursor: pointer;
	}
	.buka::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	tr.selesai .buka {
		color: var(--tinta-2);
		text-decoration: line-through;
	}
	.sub {
		display: block;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.lewat {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		color: var(--kritis);
		font-weight: 500;
	}
	.chev {
		width: 28px;
		color: var(--tinta-2);
	}
	.chev span {
		display: inline-flex;
		transition: transform var(--transisi);
	}
	.chev .putar {
		transform: rotate(180deg);
	}
	tr.terbuka td {
		background: color-mix(in srgb, var(--nila-tipis) 50%, transparent);
	}
	tr.panel-ubah > td {
		padding: 0;
		background: color-mix(in srgb, var(--kertas) 55%, var(--permukaan));
	}
	tr.panel-ubah:hover {
		background: none;
	}
	.form-raid {
		display: grid;
		gap: var(--jarak-4);
		padding: var(--jarak-6);
	}
	.baris1,
	.baris2 {
		display: grid;
		grid-template-columns: 160px 1fr 160px;
		gap: var(--jarak-4);
		align-items: end;
	}
	.baris2 {
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
	}
	.skor-pratinjau .badge {
		height: 40px;
		justify-content: center;
		font-size: var(--teks-kecil);
	}
	.aksi {
		display: flex;
		align-items: center;
		gap: var(--jarak-2);
	}
	.ruang {
		flex: 1;
	}
	.nowrap {
		white-space: nowrap;
	}
	.kecil {
		font-size: var(--teks-kecil);
	}
	.redup {
		color: var(--tinta-2);
	}
	@media (max-width: 1023px) {
		.raid-tata {
			grid-template-columns: 1fr;
		}
		.matriks-panel {
			max-width: 360px;
		}
	}
	@media (max-width: 767px) {
		.baris1 {
			grid-template-columns: 1fr;
		}
	}
</style>
