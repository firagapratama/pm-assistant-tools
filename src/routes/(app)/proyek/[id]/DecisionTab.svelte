<script lang="ts">
	// Decision log (PRD F12): keputusan tidak dihapus; pembatalan dicatat sebagai keputusan baru yang merujuk keputusan lama.
	import { ChevronDown, ExternalLink, Plus } from '@lucide/svelte';
	import { date } from '#lib/format/index.ts';

	interface Item {
		id: number;
		number: number;
		date: string;
		decision: string;
		decidedBy: string;
		reason: string;
		alternatives: string;
		impact: string;
		link: string;
		supersedesNumber: number | null;
		supersededByNumber: number | null;
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

	const label = (n: number) => `K-${n}`;
	let showCancelled = $state(true);
	let rows = $derived(showCancelled ? items : items.filter((d) => d.supersededByNumber === null));
	let active = $derived(items.filter((d) => d.supersededByNumber === null));

	let editing: number | 'baru' | null = $state(null);
	let open: number | null = $state(null);
	let saving = $state(false);
	const empty = () => ({ date: today, decision: '', decidedBy: '', reason: '', alternatives: '', impact: '', link: '', supersedesId: '' });
	let form = $state(empty());

	function startNew(supersedes: Item | null = null) {
		editing = 'baru';
		open = null;
		form = { ...empty(), supersedesId: supersedes ? String(supersedes.id) : '' };
	}

	function startEdit(d: Item) {
		editing = d.id;
		form = { date: d.date, decision: d.decision, decidedBy: d.decidedBy, reason: d.reason, alternatives: d.alternatives, impact: d.impact, link: d.link, supersedesId: '' };
	}

	async function save() {
		saving = true;
		const res = await post('saveDecision', { ...(typeof editing === 'number' ? { id: editing } : {}), ...form });
		saving = false;
		if (res) {
			open = Number(res.decisionId);
			editing = null;
		}
	}
</script>

{#snippet editor(isNew: boolean)}
	<div class="form-keputusan">
		{#if isNew && form.supersedesId}
			{@const old = items.find((d) => String(d.id) === form.supersedesId)}
			<p class="batal-info">Membatalkan/menggantikan <strong>{old ? `${label(old.number)} ${old.decision}` : ''}</strong></p>
		{/if}
		<div class="kolom">
			<label class="field">
				<span class="field-label">Keputusan</span>
				<!-- svelte-ignore a11y_autofocus -->
				<textarea rows="2" bind:value={form.decision} maxlength="2000" autofocus placeholder="Apa yang diputuskan?"></textarea>
			</label>
			<div class="kanan">
				<label class="field">
					<span class="field-label">Tanggal</span>
					<input type="date" bind:value={form.date} />
				</label>
				<label class="field">
					<span class="field-label">Pengambil keputusan <span class="opsional">· opsional</span></span>
					<input bind:value={form.decidedBy} maxlength="120" placeholder="Nama, jabatan, atau forum" />
				</label>
			</div>
		</div>
		<div class="kolom tiga">
			<label class="field">
				<span class="field-label">Alasan <span class="opsional">· opsional</span></span>
				<textarea rows="2" bind:value={form.reason} maxlength="2000"></textarea>
			</label>
			<label class="field">
				<span class="field-label">Alternatif yang dipertimbangkan <span class="opsional">· opsional</span></span>
				<textarea rows="2" bind:value={form.alternatives} maxlength="2000"></textarea>
			</label>
			<label class="field">
				<span class="field-label">Dampak <span class="opsional">· opsional</span></span>
				<textarea rows="2" bind:value={form.impact} maxlength="2000"></textarea>
			</label>
		</div>
		<div class="kolom">
			<label class="field">
				<span class="field-label">Tautan dokumen / notulen <span class="opsional">· opsional</span></span>
				<input type="url" bind:value={form.link} maxlength="500" placeholder="https://" />
			</label>
			{#if isNew}
				<label class="field">
					<span class="field-label">Membatalkan keputusan <span class="opsional">· opsional</span></span>
					<select bind:value={form.supersedesId}>
						<option value="">— Keputusan baru —</option>
						{#each active as d (d.id)}<option value={String(d.id)}>{label(d.number)} · {d.decision.slice(0, 60)}</option>{/each}
					</select>
				</label>
			{/if}
		</div>
		<div class="aksi">
			<span class="redup kecil">Keputusan tidak bisa dihapus. Untuk membatalkan, buat keputusan baru yang merujuknya.</span>
			<span class="ruang"></span>
			<button class="btn teks" onclick={() => (editing = null)} disabled={saving}>Batal</button>
			<button class="btn" onclick={save} disabled={saving || !form.decision.trim() || !form.date}>{saving ? 'Menyimpan…' : 'Simpan'}</button>
		</div>
	</div>
{/snippet}

<div class="alat">
	<label class="kecil redup centang"><input type="checkbox" bind:checked={showCancelled} /> Tampilkan yang sudah dibatalkan</label>
	<button class="btn kecil" onclick={() => startNew()}><Plus size={14} strokeWidth={2} aria-hidden="true" /> Catat keputusan</button>
</div>

{#if editing === 'baru'}
	<div class="panel baru">{@render editor(true)}</div>
{/if}

{#if items.length === 0 && editing !== 'baru'}
	<div class="kosong-blok">
		<strong>Belum ada keputusan</strong>
		<p>Catat keputusan penting proyek beserta alasan dan alternatifnya, agar tidak diperdebatkan ulang.</p>
	</div>
{:else if rows.length}
	<div class="tabel-wadah">
		<table>
			<thead>
				<tr>
					<th>No.</th>
					<th>Tanggal</th>
					<th>Keputusan</th>
					<th>Status</th>
					<th><span class="sr-only">Buka</span></th>
				</tr>
			</thead>
			<tbody>
				{#each rows as d (d.id)}
					{@const cancelled = d.supersededByNumber !== null}
					<tr class="baris" class:dibatalkan={cancelled}>
						<td class="nowrap kecil redup">{label(d.number)}</td>
						<td class="nowrap kecil">{date(d.date)}</td>
						<td class="desk">
							<button class="buka" aria-expanded={open === d.id} onclick={() => { editing = null; open = open === d.id ? null : d.id; }}>{d.decision}</button>
							{#if d.decidedBy || d.supersedesNumber}
								<span class="sub">{[d.decidedBy, d.supersedesNumber ? `menggantikan ${label(d.supersedesNumber)}` : ''].filter(Boolean).join(' · ')}</span>
							{/if}
						</td>
						<td class="nowrap">
							{#if cancelled}<span class="badge">Dibatalkan oleh {label(d.supersededByNumber!)}</span>{:else}<span class="badge aman">Berlaku</span>{/if}
						</td>
						<td class="chev"><span class:putar={open === d.id}><ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" /></span></td>
					</tr>
					{#if open === d.id}
						<tr class="panel-ubah">
							<td colspan="5">
								{#if editing === d.id}
									{@render editor(false)}
								{:else}
									{#if d.reason || d.alternatives || d.impact || d.link}
									<dl class="rincian">
										{#if d.reason}<dt>Alasan</dt><dd>{d.reason}</dd>{/if}
										{#if d.alternatives}<dt>Alternatif</dt><dd>{d.alternatives}</dd>{/if}
										{#if d.impact}<dt>Dampak</dt><dd>{d.impact}</dd>{/if}
										{#if d.link}
											<dt>Tautan</dt>
											<dd><a href={d.link} target="_blank" rel="noopener noreferrer">{d.link} <ExternalLink size={12} strokeWidth={1.75} aria-hidden="true" /></a></dd>
										{/if}
									</dl>
									{/if}
									<div class="aksi detail">
										<button class="btn teks" onclick={() => startEdit(d)}>Perbaiki isi</button>
										<span class="ruang"></span>
										{#if !cancelled}<button class="btn kecil" onclick={() => startNew(d)}>Batalkan dengan keputusan baru</button>{/if}
									</div>
								{/if}
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
{:else}
	<p class="redup kecil">Semua keputusan sudah dibatalkan. Centang "Tampilkan yang sudah dibatalkan" untuk melihatnya.</p>
{/if}

<style>
	.alat {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--jarak-4);
		margin-bottom: var(--jarak-4);
	}
	.centang {
		display: inline-flex;
		align-items: center;
		gap: var(--jarak-2);
	}
	.baru {
		margin-bottom: var(--jarak-4);
	}
	.form-keputusan {
		display: grid;
		gap: var(--jarak-4);
		padding: var(--jarak-6);
	}
	.kolom {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--jarak-4);
	}
	.kolom.tiga {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.kanan {
		display: grid;
		grid-template-columns: 170px minmax(0, 1fr);
		gap: var(--jarak-4);
		align-content: start;
	}
	.batal-info {
		margin: 0;
		padding: var(--jarak-3) var(--jarak-4);
		border-radius: var(--radius-kecil);
		background: var(--waspada-tipis);
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
	.aksi.detail {
		padding: var(--jarak-3) 0;
	}
	.rincian {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: var(--jarak-2) var(--jarak-6);
		margin: 0;
		padding: var(--jarak-4) var(--jarak-2);
	}
	.rincian dt {
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.rincian dd {
		margin: 0;
		white-space: pre-line;
		overflow-wrap: anywhere;
	}
	tr.dibatalkan .buka {
		color: var(--tinta-2);
		text-decoration: line-through;
	}
	.buka {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-weight: 500;
		color: var(--tinta);
		text-align: left;
		cursor: pointer;
	}
	.buka:hover {
		color: var(--nila);
	}
	.sub {
		display: block;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.chev span {
		display: inline-flex;
		transition: transform 0.15s;
	}
	.chev .putar {
		transform: rotate(180deg);
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
	@media (max-width: 900px) {
		.kolom,
		.kolom.tiga,
		.kanan {
			grid-template-columns: 1fr;
		}
	}
</style>
