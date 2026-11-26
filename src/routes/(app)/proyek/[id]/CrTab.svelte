<script lang="ts">
	// Change request (PRD F13): ajukan, hitung dampak dengan mesin estimasi, lalu setujui/tolak.
	import { ChevronDown, Plus, Trash2 } from '@lucide/svelte';
	import NumInput from '#lib/components/NumInput.svelte';
	import { fromHours, toHours } from '#lib/calc/units.ts';
	import { CR_STATUS_LABEL, crImpact, crLabel, scopeChange, type CrContext, type CrImpact, type CrStatus, type ThreePointMap } from '#lib/change-request.ts';
	import { date, decimal, rupiahShort } from '#lib/format/index.ts';
	import type { ProjectBaseline } from '#lib/project.ts';

	interface Item {
		id: number;
		number: number;
		title: string;
		description: string;
		requester: string;
		requestDate: string;
		reason: string;
		efforts: ThreePointMap;
		status: CrStatus;
		approver: string;
		decisionDate: string | null;
		decisionNote: string;
		impact: CrImpact | null;
		effect: CrImpact;
	}

	let {
		items,
		ctx,
		baseline,
		today,
		post
	}: {
		items: Item[];
		ctx: CrContext;
		baseline: ProjectBaseline;
		today: string;
		post: (action: string, fields: Record<string, string | number | boolean>) => Promise<Record<string, unknown> | null | undefined>;
	} = $props();

	const BADGE: Record<CrStatus, string> = { diajukan: 'waspada', disetujui: 'aman', ditolak: '' };
	let s = $derived(ctx.draft.settings);
	let unitLabel = $derived(s.inputUnit === 'sp' ? 'SP' : 'jam');
	const toUnit = (h: number) => fromHours(h, s.inputUnit, s.spPerHour);
	const fromUnit = (v: number) => toHours(v, s.inputUnit, s.spPerHour);

	let approved = $derived(items.filter((c) => c.status === 'disetujui').toSorted((a, b) => a.number - b.number));
	let scope = $derived(scopeChange(baseline, approved.map((c) => c.impact!).filter(Boolean)));
	let pendingCount = $derived(items.filter((c) => c.status === 'diajukan').length);

	let editing: number | 'baru' | null = $state(null);
	let open: number | null = $state(null);
	let saving = $state(false);
	let form = $state({ title: '', description: '', requester: '', requestDate: '', reason: '', efforts: {} as ThreePointMap });
	// svelte-ignore state_referenced_locally — tanggal keputusan bawaan: hari ini.
	let decision = $state({ approver: '', decisionDate: today, note: '' });

	/** Dampak CR yang masih diajukan: dihitung langsung terhadap baseline + CR yang sudah disetujui. */
	const liveImpact = (efforts: ThreePointMap) =>
		crImpact(
			ctx,
			approved.map((c) => c.efforts),
			efforts
		);
	let formImpact = $derived(Object.values(form.efforts).some((t) => t.m > 0 || t.p > 0) ? liveImpact(form.efforts) : null);

	function startEdit(c: Item | null) {
		editing = c ? c.id : 'baru';
		open = c?.id ?? null;
		form = c
			? { title: c.title, description: c.description, requester: c.requester, requestDate: c.requestDate, reason: c.reason, efforts: structuredClone($state.snapshot(c.efforts)) }
			: { title: '', description: '', requester: '', requestDate: today, reason: '', efforts: {} };
	}

	function toggle(c: Item) {
		editing = null;
		open = open === c.id ? null : c.id;
		decision = { approver: '', decisionDate: today, note: '' };
	}

	function setEffort(roleId: number, k: 'o' | 'm' | 'p', hours: number) {
		const t = { ...(form.efforts[roleId] ?? { o: 0, m: 0, p: 0 }), [k]: hours };
		// Mengisi M saja langsung menjadi O = M = P agar cepat; O/P bisa diperlebar setelahnya.
		if (k === 'm' && !form.efforts[roleId]) Object.assign(t, { o: hours, p: hours });
		form.efforts = { ...form.efforts, [roleId]: t };
	}

	async function save() {
		saving = true;
		const res = await post('saveCr', { ...(typeof editing === 'number' ? { id: editing } : {}), ...form, efforts: JSON.stringify(form.efforts) });
		saving = false;
		if (res) {
			open = Number(res.crId);
			editing = null;
			decision = { approver: '', decisionDate: today, note: '' };
		}
	}

	async function decide(c: Item, status: 'disetujui' | 'ditolak') {
		saving = true;
		const res = await post('decideCr', { id: c.id, status, ...decision });
		saving = false;
		if (res) open = c.id;
	}

	async function remove(c: Item) {
		if (!confirm(`Hapus ${crLabel(c.number)} "${c.title}"?`)) return;
		await post('deleteCr', { id: c.id });
		editing = open = null;
	}

	const signed = (n: number, digits = 0) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${decimal(Math.abs(n), digits)}`;
	const effortText = (h: number) => `${signed(toUnit(h), 1)} ${unitLabel}`;
	const priceText = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${rupiahShort(Math.abs(n))}`;
	const roleName = (id: number) => baseline.team.find((t) => t.roleId === id)?.name ?? `Peran #${id}`;
</script>

{#snippet impactView(i: CrImpact, live: boolean)}
	<dl class="dampak" aria-label={live ? 'Perkiraan dampak' : 'Dampak saat diputuskan'}>
		<div><dt>Effort</dt><dd>{effortText(i.effortHours)} <span class="redup">({signed((i.effortHours / baseline.effortHours) * 100, 1)}% baseline)</span></dd></div>
		<div><dt>Sprint</dt><dd>{signed(i.sprints)}</dd></div>
		<div><dt>Harga jual</dt><dd>{priceText(i.price)}</dd></div>
		<div><dt>Biaya</dt><dd>{priceText(i.cost)}</dd></div>
	</dl>
{/snippet}

{#snippet editor()}
	<div class="form-cr">
		<div class="kolom">
			<label class="field judul">
				<span class="field-label">Perubahan</span>
				<!-- svelte-ignore a11y_autofocus -->
				<input bind:value={form.title} maxlength="160" autofocus placeholder="Contoh: Tambah laporan stok harian" />
			</label>
			<label class="field">
				<span class="field-label">Peminta <span class="opsional">· opsional</span></span>
				<input bind:value={form.requester} maxlength="120" placeholder="Nama / pihak klien" />
			</label>
			<label class="field">
				<span class="field-label">Tanggal</span>
				<input type="date" bind:value={form.requestDate} />
			</label>
		</div>
		<div class="kolom dua">
			<label class="field">
				<span class="field-label">Deskripsi <span class="opsional">· opsional</span></span>
				<textarea rows="2" bind:value={form.description} maxlength="2000"></textarea>
			</label>
			<label class="field">
				<span class="field-label">Alasan <span class="opsional">· opsional</span></span>
				<textarea rows="2" bind:value={form.reason} maxlength="2000"></textarea>
			</label>
		</div>
		<fieldset class="field">
			<legend class="field-label">Effort per peran ({unitLabel}) — optimis / paling mungkin / pesimis</legend>
			<div class="effort">
				{#each baseline.team as t (t.roleId)}
					{@const e = form.efforts[t.roleId] ?? { o: 0, m: 0, p: 0 }}
					<span class="peran">{t.name}</span>
					{#each ['o', 'm', 'p'] as const as k (k)}
									<NumInput
										value={e[k]}
										onchange={(v) => setEffort(t.roleId, k, v ?? 0)}
										toDisplay={toUnit}
										fromDisplay={fromUnit}
										digits={1}
										label="{t.name} {k === 'o' ? 'optimis' : k === 'm' ? 'paling mungkin' : 'pesimis'}"
									/>
					{/each}
				{/each}
			</div>
		</fieldset>
		{#if formImpact}
			<div class="pratinjau">
				<span class="field-label">Perkiraan dampak (di atas baseline{approved.length ? ` + ${approved.length} CR disetujui` : ''})</span>
				{@render impactView(formImpact, true)}
			</div>
		{/if}
		<div class="aksi">
			{#if typeof editing === 'number'}
				{@const c = items.find((x) => x.id === editing)!}
				<button class="btn kecil bahaya" onclick={() => remove(c)} disabled={saving}><Trash2 size={14} strokeWidth={1.75} aria-hidden="true" /> Hapus</button>
			{/if}
			<span class="ruang"></span>
			<button class="btn teks" onclick={() => (editing = null)} disabled={saving}>Batal</button>
			<button class="btn" onclick={save} disabled={saving || !form.title.trim() || !formImpact}>{saving ? 'Menyimpan…' : 'Simpan'}</button>
		</div>
	</div>
{/snippet}

<section class="panel ringkas" aria-label="Perubahan scope">
	<div>
		<span class="label">Perubahan scope disetujui</span>
		<strong>{signed(scope.effortPct, 1)}% effort</strong>
		<span class="sub">{scope.count} CR · {effortText(scope.effortHours)} dari baseline</span>
	</div>
	<div>
		<span class="label">Tambahan sprint</span>
		<strong>{signed(scope.sprints)}</strong>
		<span class="sub">baseline {baseline.totalSprints} sprint</span>
	</div>
	<div>
		<span class="label">Tambahan harga jual</span>
		<strong>{priceText(scope.price)}</strong>
		<span class="sub">baseline {rupiahShort(baseline.price)}</span>
	</div>
	<div>
		<span class="label">Menunggu keputusan</span>
		<strong class:waspada-teks={pendingCount > 0}>{pendingCount}</strong>
		<span class="sub">CR diajukan</span>
	</div>
</section>

<div class="alat">
	<p class="redup kecil">CR yang disetujui masuk jadwal dan menggeser target selesai; baseline asli tetap untuk perbandingan. Keputusan tidak bisa diubah.</p>
	<button class="btn kecil" onclick={() => startEdit(null)}><Plus size={14} strokeWidth={2} aria-hidden="true" /> Ajukan CR</button>
</div>

{#if editing === 'baru'}
	<div class="panel baru">{@render editor()}</div>
{/if}

{#if items.length === 0 && editing !== 'baru'}
	<div class="kosong-blok">
		<strong>Belum ada change request</strong>
		<p>Catat permintaan perubahan scope dari klien beserta dampaknya ke effort, sprint, dan biaya.</p>
	</div>
{:else if items.length}
	<div class="tabel-wadah">
		<table>
			<thead>
				<tr>
					<th>No.</th>
					<th>Perubahan</th>
					<th class="angka">Effort</th>
					<th class="angka">Sprint</th>
					<th class="angka">Harga</th>
					<th>Status</th>
					<th><span class="sr-only">Buka</span></th>
				</tr>
			</thead>
			<tbody>
				{#each items as c (c.id)}
					{@const i = c.effect}
					<tr class="baris" class:terbuka={open === c.id} class:ditolak={c.status === 'ditolak'}>
						<td class="nowrap kecil redup">{crLabel(c.number)}</td>
						<td class="desk">
							<button class="buka" aria-expanded={open === c.id} onclick={() => toggle(c)}>{c.title}</button>
							<span class="sub">{[c.requester, date(c.requestDate)].filter(Boolean).join(' · ')}</span>
						</td>
						<td class="angka nowrap">{effortText(i.effortHours)}</td>
						<td class="angka">{signed(i.sprints)}</td>
						<td class="angka nowrap">{priceText(i.price)}</td>
						<td class="nowrap"><span class="badge {BADGE[c.status]}">{CR_STATUS_LABEL[c.status]}</span></td>
						<td class="chev"><span class:putar={open === c.id}><ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" /></span></td>
					</tr>
					{#if open === c.id}
						<tr class="panel-ubah">
							<td colspan="7">
								{#if editing === c.id}
									{@render editor()}
								{:else}
									<div class="rincian">
										{#if c.description}<p>{c.description}</p>{/if}
										{#if c.reason}<p><span class="redup">Alasan:</span> {c.reason}</p>{/if}
										<p class="kecil redup">
											Effort: {Object.entries(c.efforts)
												.map(([id, t]) => `${roleName(Number(id))} ${decimal(toUnit(t.o), 1)}/${decimal(toUnit(t.m), 1)}/${decimal(toUnit(t.p), 1)} ${unitLabel}`)
												.join(' · ')}
										</p>
										{@render impactView(i, !c.impact)}
										{#if c.status === 'diajukan'}
											<div class="keputusan">
												<label class="field">
													<span class="field-label">Penyetuju</span>
													<input bind:value={decision.approver} maxlength="120" placeholder="Nama pengambil keputusan" />
												</label>
												<label class="field">
													<span class="field-label">Tanggal keputusan</span>
													<input type="date" bind:value={decision.decisionDate} min={c.requestDate} />
												</label>
												<label class="field catatan">
													<span class="field-label">Catatan <span class="opsional">· opsional</span></span>
													<input bind:value={decision.note} maxlength="2000" />
												</label>
											</div>
											<div class="aksi">
												<button class="btn teks" onclick={() => startEdit(c)} disabled={saving}>Ubah</button>
												<span class="ruang"></span>
												<button class="btn" onclick={() => decide(c, 'ditolak')} disabled={saving || !decision.approver.trim()}>Tolak</button>
												<button class="btn primer" onclick={() => decide(c, 'disetujui')} disabled={saving || !decision.approver.trim()}>Setujui</button>
											</div>
										{:else}
											<p class="kecil">
												{CR_STATUS_LABEL[c.status]} oleh <strong>{c.approver}</strong> pada {date(c.decisionDate!)}{c.decisionNote ? ` — ${c.decisionNote}` : ''}.
												{#if c.status === 'disetujui'}<a href="?tab=jadwal">Lihat di jadwal</a>{/if}
											</p>
										{/if}
									</div>
								{/if}
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.ringkas {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		margin-bottom: var(--jarak-6);
	}
	.ringkas > div {
		display: grid;
		gap: 2px;
		padding: var(--jarak-4) var(--jarak-6);
		border-right: 1px solid var(--garis);
	}
	.ringkas > div:last-child {
		border-right: 0;
	}
	.ringkas strong {
		font-size: var(--teks-h3);
		font-variant-numeric: tabular-nums;
	}
	.label {
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.sub {
		display: block;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.alat {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--jarak-4);
		margin-bottom: var(--jarak-4);
	}
	.alat p {
		margin: 0;
	}
	.baru {
		margin-bottom: var(--jarak-4);
	}
	.form-cr {
		display: grid;
		gap: var(--jarak-4);
		padding: var(--jarak-6);
	}
	.kolom {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 200px 160px;
		gap: var(--jarak-4);
	}
	.kolom.dua {
		grid-template-columns: 1fr 1fr;
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}
	.effort {
		display: grid;
		grid-template-columns: minmax(120px, max-content) repeat(3, 110px);
		gap: var(--jarak-2) var(--jarak-2);
		align-items: center;
		margin-top: var(--jarak-2);
	}
	.peran {
		padding-right: var(--jarak-4);
		font-size: var(--teks-isi);
	}
	.pratinjau {
		display: grid;
		gap: var(--jarak-2);
		padding: var(--jarak-4);
		border-radius: var(--radius-kecil);
		background: var(--nila-tipis);
	}
	.dampak {
		display: flex;
		flex-wrap: wrap;
		gap: var(--jarak-2) var(--jarak-8);
		margin: 0;
	}
	.dampak div {
		display: grid;
	}
	.dampak dt {
		font-size: var(--teks-mini);
		color: var(--tinta-2);
	}
	.dampak dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}
	.aksi {
		display: flex;
		align-items: center;
		gap: var(--jarak-2);
	}
	.ruang {
		flex: 1;
	}
	.keputusan {
		display: grid;
		grid-template-columns: 220px 170px minmax(0, 1fr);
		gap: var(--jarak-4);
	}
	.rincian {
		display: grid;
		gap: var(--jarak-3);
		padding: var(--jarak-4) var(--jarak-2);
	}
	.rincian p {
		margin: 0;
	}
	tr.baris.ditolak td {
		color: var(--tinta-2);
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
	.waspada-teks {
		color: var(--waspada);
	}
	@media (max-width: 900px) {
		.ringkas {
			grid-template-columns: repeat(2, 1fr);
		}
		.kolom,
		.kolom.dua,
		.keputusan {
			grid-template-columns: 1fr;
		}
	}
</style>
