<script lang="ts">
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import { ArrowLeft, Check, FileText, Lock, Plus, RotateCcw, Trash2 } from '@lucide/svelte';
	import { addDays } from '#lib/calc/calendar.ts';
	import { pertE } from '#lib/calc/pert.ts';
	import { toast } from '#lib/components/toast.svelte.ts';
	import { date, decimal, range, rupiah, rupiahShort, todayIso } from '#lib/format/index.ts';
	import { maxPlanSprint } from '#lib/project.ts';
	import { HEALTHS, HEALTH_LABEL, projectStatus, statusInputFrom, type Health } from '#lib/project-status.ts';
	import RaidTab from './RaidTab.svelte';
	import ReportsTab from './ReportsTab.svelte';
	import Gantt, { type GanttActivity } from './Gantt.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let pr = $derived(data.project);
	let b = $derived(pr.baseline);
	let est = $derived(data.estimate);
	const today = todayIso();
	const DAY = 86_400_000;
	const STATUS = { aktif: 'Aktif', selesai: 'Selesai', ditunda: 'Ditunda' } as const;
	const PRIORITY = { must: 'Must', should: 'Should', could: 'Could' } as const;

	// ── Tab (disimpan di URL agar tautan dan muat ulang tetap di tab yang sama) ──
	const TABS = [
		{ id: 'jadwal', label: 'Jadwal' },
		{ id: 'raid', label: 'RAID' },
		{ id: 'laporan', label: 'Laporan' },
		{ id: 'baseline', label: 'Baseline & tim' },
		{ id: 'lingkup', label: 'Ruang lingkup' }
	] as const;
	let tab = $derived(TABS.find((t) => t.id === page.url.searchParams.get('tab'))?.id ?? 'jadwal');

	// ── Status (sumber yang sama dengan laporan mingguan) ──
	let st = $derived(projectStatus(statusInputFrom(data, today)));
	// Kalender yang sama dengan baseline (salinan libur di estimasi final).
	let calendar = $derived(st.calendar);
	let ganttRows = $derived(st.features);
	let ganttActivities: GanttActivity[] = $derived(st.activities);
	let overall = $derived(st.overall);
	let expected = $derived(st.expected);
	let lateCount = $derived(st.late.length);
	let plannedEnd = $derived(st.plannedEnd);
	let slipDays = $derived(st.slipDays);

	// ── Jadwal ──
	let sprintDays = $derived(est.draft.settings.sprintWeeks * 7);
	const sprintOf = (iso: string) => Math.floor((Date.parse(iso) - Date.parse(pr.startDate)) / DAY / sprintDays) + 1;
	let maxSprint = $derived(maxPlanSprint(b.totalSprints));
	let lastSprint = $derived(Math.max(b.totalSprints, ...data.activities.map((a) => sprintOf(a.endDate))));
	let windows = $derived(calendar.schedule(lastSprint));
	let moved = $derived(data.schedule.some((r) => r.planStart !== r.baselineStart || r.planEnd !== r.baselineEnd));
	const sprintOptions = $derived(Array.from({ length: maxSprint }, (_, i) => i + 1));
	const statusOf = (p: number) => (p >= 100 ? 'Selesai' : p > 0 ? 'Berjalan' : 'Belum');

	let editOpen = $state(false);
	let selected: string | null = $state(null);
	let saving: string | null = $state(null);

	async function post(action: string, fields: Record<string, string | number | boolean>) {
		const body = new FormData();
		for (const [k, v] of Object.entries(fields)) body.set(k, String(v));
		const res = await fetch(`?/${action}`, { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
		const result = deserialize(await res.text());
		if (result.type === 'success') {
			if (typeof result.data?.message === 'string') toast(result.data.message);
			await invalidateAll();
			return result.data;
		}
		toast(result.type === 'failure' ? String(result.data?.message ?? 'Gagal menyimpan.') : 'Terjadi kesalahan. Muat ulang halaman.', 'error');
		await invalidateAll();
		return null;
	}

	async function saveRow(r: (typeof data.schedule)[number], patch: Partial<{ planStart: number; planEnd: number; progress: number }>) {
		const next = { planStart: r.planStart, planEnd: r.planEnd, progress: r.progress, ...patch };
		// Menggeser mulai melewati selesai ikut menggeser selesai, dan sebaliknya.
		if (patch.planStart !== undefined && next.planEnd < next.planStart) next.planEnd = next.planStart;
		if (patch.planEnd !== undefined && next.planStart > next.planEnd) next.planStart = next.planEnd;
		next.progress = Math.round(Math.min(100, Math.max(0, next.progress)));
		saving = `f${r.featureId}`;
		await post('updateFeature', { featureId: r.featureId, ...next });
		saving = null;
	}

	type Activity = (typeof data.activities)[number];
	async function saveActivity(a: Activity, patch: Partial<Activity>) {
		const next = { ...a, ...patch };
		if (next.kind === 'milestone') next.endDate = next.startDate;
		else if (patch.startDate && next.endDate < next.startDate) next.endDate = next.startDate;
		saving = `a${a.id}`;
		await post('saveActivity', { id: a.id, name: next.name, kind: next.kind, startDate: next.startDate, endDate: next.endDate, done: next.done });
		saving = null;
	}

	async function addActivity() {
		const start = today > pr.startDate ? today : pr.startDate;
		const res = await post('saveActivity', { name: 'Aktivitas baru', kind: 'aktivitas', startDate: start, endDate: addDays(start, 4), done: false });
		if (res?.activityId) await focusRow(`a${res.activityId}`, 'input');
	}

	async function focusRow(key: string, selector = 'select, input') {
		editOpen = true;
		selected = key;
		await tick();
		const row = document.getElementById(`baris-${key}`);
		row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		(row?.querySelector(selector) as HTMLElement | null)?.focus({ preventScroll: true });
	}

	// ── Status manual (F10) ──
	let healthOpen = $state(false);
	let healthForm: { health: Health | ''; reason: string } = $state({ health: '', reason: '' });
	function openHealth() {
		healthForm = { health: pr.healthOverride ?? '', reason: pr.healthReason ?? '' };
		healthOpen = true;
	}
	async function saveHealth(e: SubmitEvent) {
		e.preventDefault();
		saving = 'health';
		const ok = await post('setHealth', healthForm.health ? healthForm : { health: '' });
		saving = null;
		if (ok) healthOpen = false;
	}

	const featureHours = (f: (typeof est.draft.features)[number]) => Object.values(f.efforts).reduce((a, t) => a + pertE(t), 0);
</script>

<svelte:head><title>{data.prospect.name} · Proyek · PM Workspace</title></svelte:head>

<a class="kembali" href="/proyek"><ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" /> Proyek</a>

<header class="halaman-kepala">
	<div>
		<div class="judul">
			<h1>{data.prospect.name}</h1>
			<span class="badge" class:aman={pr.status === 'aktif'}>{STATUS[pr.status]}</span>
		</div>
		<p>
			{[data.prospect.client, `mulai ${date(pr.startDate)}`].filter(Boolean).join(' · ')} ·
			<a href="/prospek/{data.prospect.id}">prospek</a> ·
			<a href="/prospek/{data.prospect.id}/estimasi/{b.estimateVersion}">estimasi v{b.estimateVersion}</a>
		</p>
	</div>
	<a class="btn" href="/cetak/{est.id}"><FileText size={16} strokeWidth={1.75} aria-hidden="true" /> Ringkasan baseline</a>
</header>

<!-- Ringkasan status: selalu terlihat di semua tab -->
<section class="panel strip" aria-label="Status proyek">
	<div>
		<span class="label">Status</span>
		<strong class="status-baris">
			<span class="badge kesehatan {st.health}">{HEALTH_LABEL[st.health]}</span>
			{#if st.override}<span class="manual">manual</span>{/if}
			<button type="button" class="btn teks kecil" aria-expanded={healthOpen} onclick={() => (healthOpen ? (healthOpen = false) : openHealth())}>Ubah</button>
		</strong>
		<span class="sub" title={st.reasons.join('\n')}>{st.reasons[0] ?? 'Sesuai rencana'}{st.reasons.length > 1 ? ` (+${st.reasons.length - 1})` : ''}</span>
	</div>
	<div>
		<span class="label">Progres</span>
		<strong>{decimal(overall, 0)}%</strong>
		<span class="sub">{today >= pr.startDate ? `rencana hari ini ${decimal(expected, 0)}%` : 'belum dimulai'}</span>
	</div>
	<div>
		<span class="label">Selesai (rencana)</span>
		<strong>{date(plannedEnd)}</strong>
		<span class="sub" class:waspada-teks={slipDays > 0}>
			{slipDays > 0 ? `${slipDays} hari setelah baseline` : slipDays < 0 ? `${-slipDays} hari lebih awal` : 'sesuai baseline'}
		</span>
	</div>
	<div>
		<span class="label">Risiko tinggi</span>
		<strong class:kritis-teks={st.highRisks.length > 0}>{st.highRisks.length}</strong>
		<span class="sub">{st.overdueReviews.length ? `${st.overdueReviews.length} lewat tanggal tinjau` : `${lateCount} item terlambat`}</span>
	</div>
</section>

{#if healthOpen}
	<form class="panel form-status" onsubmit={saveHealth} aria-label="Ubah status kesehatan">
		<fieldset class="field">
			<legend class="field-label">Status</legend>
			<div class="pilih-status">
				<label><input type="radio" name="health" value="" bind:group={healthForm.health} /> Otomatis ({HEALTH_LABEL[st.autoHealth]})</label>
				{#each HEALTHS as h (h)}
					<label><input type="radio" name="health" value={h} bind:group={healthForm.health} /> {HEALTH_LABEL[h]}</label>
				{/each}
			</div>
		</fieldset>
		{#if healthForm.health}
			<label class="field">
				<span class="field-label">Alasan</span>
				<textarea rows="2" maxlength="500" required bind:value={healthForm.reason} placeholder="Mengapa status otomatis tidak mewakili kondisi proyek?"></textarea>
			</label>
		{/if}
		{#if st.autoHealth !== 'hijau'}
			<p class="field-hint">Alasan otomatis: {st.reasons.filter((r) => !r.startsWith('Ditetapkan PM')).join(' · ')}</p>
		{/if}
		<div class="aksi-status">
			<button type="button" class="btn teks" onclick={() => (healthOpen = false)}>Batal</button>
			<button class="btn" disabled={saving === 'health'}>Simpan status</button>
		</div>
	</form>
{/if}

<nav class="tab" aria-label="Bagian proyek">
	{#each TABS as t (t.id)}
		<a
			href="?tab={t.id}"
			data-sveltekit-noscroll
			data-sveltekit-replacestate
			aria-current={tab === t.id ? 'page' : undefined}
		>
			{t.label}
			{#if t.id === 'jadwal' && lateCount > 0}<span class="titik" aria-label="{lateCount} terlambat"></span>{/if}
			{#if t.id === 'raid' && st.highRisks.length}<span class="titik" aria-label="{st.highRisks.length} risiko tinggi"></span>{/if}
			{#if t.id === 'laporan' && data.reports.some((r) => !r.sentAt)}<span class="jumlah">draf</span>{/if}
		</a>
	{/each}
</nav>

{#if tab === 'jadwal'}
	<section aria-label="Jadwal">
		<div class="alat">
			<p class="ringkas">Klik aktivitas untuk mengubahnya. Progres fitur ada di tabel di bawah.</p>
			<button class="btn kecil" onclick={addActivity}><Plus size={14} strokeWidth={2} aria-hidden="true" /> Tambah aktivitas</button>
		</div>

		<Gantt activities={ganttActivities} {windows} {today} onselect={(id) => focusRow(`a${id}`, 'input')} />

		<details class="ubah" bind:open={editOpen}>
			<summary>Ubah jadwal &amp; progres <span class="redup">(tabel lengkap)</span></summary>

			<h3>Aktivitas &amp; milestone</h3>
			<div class="tabel-wadah">
				<table>
					<thead>
						<tr>
							<th>Nama</th>
							<th>Jenis</th>
							<th>Mulai</th>
							<th>Selesai</th>
							<th>Status</th>
							<th><span class="sr-only">Aksi</span></th>
						</tr>
					</thead>
					<tbody>
						{#each ganttActivities as a (a.id)}
							{@const raw = data.activities.find((x) => x.id === a.id)!}
							{@const busy = saving === `a${a.id}`}
							<tr id="baris-a{a.id}" class:dipilih={selected === `a${a.id}`}>
								<td>
									<input class="nama-input" value={a.name} aria-label="Nama aktivitas" disabled={busy} onchange={(e) => saveActivity(raw, { name: e.currentTarget.value })} />
								</td>
								<td>
									<select aria-label="Jenis {a.name}" value={a.kind} disabled={busy} onchange={(e) => saveActivity(raw, { kind: e.currentTarget.value as 'aktivitas' | 'milestone' })}>
										<option value="aktivitas">Aktivitas</option>
										<option value="milestone">Milestone</option>
									</select>
								</td>
								<td>
									<input type="date" aria-label="Mulai {a.name}" value={a.startDate} min={pr.startDate} disabled={busy} onchange={(e) => saveActivity(raw, { startDate: e.currentTarget.value })} />
								</td>
								<td>
									{#if a.kind === 'aktivitas'}
										<input type="date" aria-label="Selesai {a.name}" value={a.endDate} min={a.startDate} disabled={busy} onchange={(e) => saveActivity(raw, { endDate: e.currentTarget.value })} />
									{:else}
										<span class="redup kecil">–</span>
									{/if}
								</td>
								<td class="nowrap">
									<label class="cek">
										<input type="checkbox" checked={a.done} disabled={busy} onchange={(e) => saveActivity(raw, { done: e.currentTarget.checked })} />
										{#if a.done}<span class="badge aman">Selesai</span>{:else if a.flag}<span class="badge kritis">Terlambat</span>{:else}<span class="redup kecil">Belum</span>{/if}
									</label>
								</td>
								<td class="aksi-sel">
									<button class="btn teks kecil" aria-label="Hapus {a.name}" disabled={busy} onclick={() => post('deleteActivity', { id: a.id })}>
										<Trash2 size={14} strokeWidth={1.75} />
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="sub-kepala">
				<h3>Fitur</h3>
				{#if moved}
					<button class="btn kecil" onclick={() => post('resetSchedule', {})}>
						<RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" /> Kembalikan fitur ke baseline
					</button>
				{/if}
			</div>
			<div class="tabel-wadah">
				<table>
					<thead>
						<tr>
							<th>Fitur</th>
							<th>Baseline</th>
							<th>Mulai</th>
							<th>Selesai</th>
							<th>Tanggal</th>
							<th class="angka">Progres</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody>
						{#each ganttRows as r (r.featureId)}
							{@const raw = data.schedule.find((x) => x.featureId === r.featureId)!}
							{@const busy = saving === `f${r.featureId}`}
							<tr id="baris-f{r.featureId}" class:dipilih={selected === `f${r.featureId}`}>
								<td><span class="sub">{r.module}</span>{r.name}</td>
								<td class="redup nowrap">S{raw.baselineStart}{raw.baselineEnd !== raw.baselineStart ? `–${raw.baselineEnd}` : ''}</td>
								<td>
									<select aria-label="Sprint mulai {r.name}" value={r.planStart} disabled={busy} onchange={(e) => saveRow(raw, { planStart: Number(e.currentTarget.value) })}>
										{#each sprintOptions as n (n)}<option value={n}>S{n}</option>{/each}
									</select>
								</td>
								<td>
									<select aria-label="Sprint selesai {r.name}" value={r.planEnd} disabled={busy} onchange={(e) => saveRow(raw, { planEnd: Number(e.currentTarget.value) })}>
										{#each sprintOptions as n (n)}<option value={n}>S{n}</option>{/each}
									</select>
								</td>
								<td class="redup nowrap kecil">{date(calendar.sprint(r.planStart - 1).from)} – {date(calendar.sprint(r.planEnd - 1).to)}</td>
								<td class="angka">
									<span class="progres">
										<span class="input-grup kecil-input">
											<input type="number" min="0" max="100" step="5" class="angka" aria-label="Progres {r.name} dalam persen" value={r.progress} disabled={busy} onchange={(e) => saveRow(raw, { progress: Number(e.currentTarget.value) })} />
											<span class="affix">%</span>
										</span>
										{#if r.progress < 100}
											<button class="btn teks kecil" title="Tandai selesai" aria-label="Tandai {r.name} selesai" disabled={busy} onclick={() => saveRow(raw, { progress: 100 })}><Check size={14} strokeWidth={2} /></button>
										{/if}
									</span>
								</td>
								<td class="nowrap">
									{#if r.flag === 'terlambat'}
										<span class="badge kritis">Terlambat</span>
									{:else if r.flag === 'belum-mulai'}
										<span class="badge waspada">Belum dimulai</span>
									{:else}
										<span class="badge" class:aman={r.progress >= 100} class:final={r.progress > 0 && r.progress < 100}>{statusOf(r.progress)}</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="catatan-kecil">
				Baseline fitur dihitung otomatis dari urutan fitur dan kapasitas tiap peran per sprint (termasuk libur). Mengubah
				sprint rencana tidak mengubah baseline (kolom Baseline).
			</p>
		</details>
	</section>
{:else if tab === 'baseline'}
	<section class="panel baseline" aria-labelledby="baseline-judul">
		<div class="panel-kepala">
			<h2 id="baseline-judul">Baseline</h2>
			<span class="terkunci"><Lock size={14} strokeWidth={1.75} aria-hidden="true" /> Terkunci sejak Deal; perubahan scope lewat change request</span>
		</div>
		<div class="angka-grid">
			<div>
				<span class="label">Durasi</span>
				<strong>{b.totalSprints} sprint</strong>
				<span class="sub">± {decimal(b.months, 1)} bulan · rentang {range(String(b.sprintsLow), String(b.sprintsHigh))} sprint</span>
			</div>
			<div>
				<span class="label">Selesai</span>
				<strong>{date(b.endDate)}</strong>
				<span class="sub">mulai {date(pr.startDate)}</span>
			</div>
			<div>
				<span class="label">Harga</span>
				<strong>{rupiahShort(b.price)}</strong>
				<span class="sub">rentang {range(rupiahShort(b.priceLow), rupiahShort(b.priceHigh))}</span>
			</div>
			<div>
				<span class="label">Biaya</span>
				<strong>{rupiahShort(b.total)}</strong>
				<span class="sub">margin {decimal(b.margin * 100, 1)}% · effort {decimal(b.effortHours, 0)} jam</span>
			</div>
		</div>
	</section>

	<div class="dua-kolom">
		<section aria-labelledby="sprint-judul">
			<h2 id="sprint-judul" class="judul-bagian">Kalender sprint</h2>
			<div class="tabel-wadah">
				<table>
					<thead>
						<tr>
							<th>Sprint</th>
							<th>Tanggal</th>
							<th class="angka">Hari kerja</th>
							<th>Libur</th>
						</tr>
					</thead>
					<tbody>
						{#each data.sprints as s (s.id)}
							{@const w = calendar.sprint(s.number - 1)}
							{@const current = s.startDate <= today && today <= s.endDate}
							<tr class:berjalan={current}>
								<td>
									{s.number}
									{#if s.plan !== 'Pengembangan'}<span class="tanda">{s.plan}</span>{/if}
									{#if current}<span class="badge final">Berjalan</span>{/if}
								</td>
								<td class="nowrap">{date(s.startDate)} – {date(s.endDate)}</td>
								<td class="angka" class:berkurang={w.holidays.length > 0}>
									{decimal(w.workingDays, 1)} / {decimal(est.draft.settings.workDaysPerSprint, 1)}
								</td>
								<td class="redup kecil">{[...new Set(w.holidays.map((h) => h.name))].join(', ') || '–'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		<section aria-labelledby="tim-judul">
			<h2 id="tim-judul" class="judul-bagian">Tim baseline</h2>
			<div class="tabel-wadah">
				<table>
					<thead>
						<tr>
							<th>Peran</th>
							<th class="angka">Orang</th>
							<th class="angka">Bulan</th>
							<th class="angka">Biaya</th>
						</tr>
					</thead>
					<tbody>
						{#each b.team as t (t.roleId)}
							<tr>
								<td>{t.name}</td>
								<td class="angka">{decimal(t.mp, 2)}</td>
								<td class="angka">{decimal(t.months, 1)}</td>
								<td class="angka">{rupiah(t.amount)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	</div>
{:else if tab === 'raid'}
	<RaidTab items={data.raid} {today} {post} />
{:else if tab === 'laporan'}
	<ReportsTab {data} {today} {post} />
{:else}
	<section aria-label="Ruang lingkup baseline">
		<div class="tabel-wadah">
			<table>
				<thead>
					<tr>
						<th>Modul</th>
						<th>Fitur</th>
						<th>Prioritas</th>
						<th class="angka">Effort (jam)</th>
					</tr>
				</thead>
				<tbody>
					{#each est.draft.features as f, i (i)}
						<tr>
							<td class="redup">{f.module}</td>
							<td>{f.name}</td>
							<td>{PRIORITY[f.priority]}</td>
							<td class="angka">{decimal(featureHours(f), 1)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
{/if}

<style>
	.judul {
		display: flex;
		align-items: center;
		gap: var(--jarak-3);
	}
	.halaman-kepala p a {
		color: var(--tinta-2);
	}
	.strip {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		margin-bottom: var(--jarak-6);
	}
	.strip > div,
	.angka-grid > div {
		display: grid;
		gap: 2px;
		padding: var(--jarak-4) var(--jarak-6);
		border-right: 1px solid var(--garis);
	}
	.strip > div:last-child,
	.angka-grid > div:last-child {
		border-right: 0;
	}
	.label {
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.strip strong,
	.angka-grid strong {
		font-size: var(--teks-h2);
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	.sub {
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.waspada-teks {
		color: var(--waspada);
		font-weight: 500;
	}
	.kritis-teks {
		color: var(--kritis);
	}
	.kesehatan {
		font-size: var(--teks-isi);
		padding: 2px var(--jarak-3);
	}
	.kesehatan.hijau { background: var(--aman-tipis); color: var(--aman); }
	.kesehatan.kuning { background: var(--waspada-tipis); color: var(--waspada); }
	.kesehatan.kuning::before { background: var(--waspada-ikon); }
	.kesehatan.merah { background: var(--kritis-tipis); color: var(--kritis); }
	.status-baris {
		display: flex;
		align-items: center;
		gap: var(--jarak-2);
	}
	.status-baris .btn {
		margin-left: auto;
	}
	.manual {
		font-size: var(--teks-mini);
		font-weight: 400;
		color: var(--tinta-2);
	}
	.form-status {
		display: grid;
		gap: var(--jarak-4);
		padding: var(--jarak-6);
		margin-bottom: var(--jarak-6);
	}
	.form-status fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}
	.pilih-status {
		display: flex;
		flex-wrap: wrap;
		gap: var(--jarak-2) var(--jarak-6);
		font-size: var(--teks-isi);
	}
	.pilih-status label {
		display: inline-flex;
		align-items: center;
		gap: var(--jarak-2);
	}
	.aksi-status {
		display: flex;
		justify-content: flex-end;
		gap: var(--jarak-2);
	}
	.strip .sub {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tab {
		display: flex;
		gap: var(--jarak-1);
		margin-bottom: var(--jarak-6);
		border-bottom: 1px solid var(--garis);
	}
	.tab a {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 40px;
		padding: 0 var(--jarak-4);
		color: var(--tinta-2);
		font-weight: 500;
		text-decoration: none;
	}
	.tab a:hover {
		color: var(--tinta);
	}
	.tab a[aria-current='page'] {
		color: var(--nila);
	}
	.tab a[aria-current='page']::after {
		content: '';
		position: absolute;
		left: var(--jarak-2);
		right: var(--jarak-2);
		bottom: -1px;
		height: 2px;
		border-radius: 2px 2px 0 0;
		background: var(--nila);
	}
	.titik {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--kritis);
	}
	.jumlah {
		min-width: 20px;
		padding: 0 6px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--kertas), var(--garis) 60%);
		font-size: var(--teks-mini);
		color: var(--tinta-2);
		text-align: center;
	}
	.alat {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--jarak-4);
		margin-bottom: var(--jarak-3);
	}
	.sub-kepala {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: var(--jarak-4);
	}
	.ringkas {
		margin: 0;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.ubah {
		margin-top: var(--jarak-6);
	}
	.ubah summary {
		cursor: pointer;
		font-weight: 500;
		padding: var(--jarak-2) 0;
	}
	.ubah h3 {
		margin: var(--jarak-4) 0 var(--jarak-2);
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.ubah td {
		padding-top: var(--jarak-2);
		padding-bottom: var(--jarak-2);
	}
	.ubah select,
	.ubah input[type='date'] {
		width: auto;
		height: 32px;
		padding-left: var(--jarak-2);
		font-size: var(--teks-kecil);
	}
	.nama-input {
		height: 32px;
		font-size: var(--teks-kecil);
	}
	.cek {
		display: inline-flex;
		align-items: center;
		gap: var(--jarak-2);
		cursor: pointer;
	}
	.cek input {
		accent-color: var(--nila);
	}
	.ubah .sub {
		display: block;
		font-size: var(--teks-mini);
	}
	tr.dipilih td {
		background: color-mix(in srgb, var(--nila-tipis) 60%, transparent);
	}
	.progres {
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}
	.kecil-input {
		width: 84px;
		height: 32px;
	}
	.kecil-input input {
		padding: 0 var(--jarak-2);
	}
	.aksi-sel {
		width: 1%;
		text-align: right;
	}
	.catatan-kecil {
		margin: var(--jarak-3) 0 0;
		max-width: 90ch;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.baseline {
		margin-bottom: var(--jarak-8);
	}
	.baseline h2 {
		font-size: var(--teks-isi);
	}
	.terkunci {
		display: inline-flex;
		align-items: center;
		gap: var(--jarak-1);
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.angka-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
	}
	.dua-kolom {
		display: grid;
		grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
		gap: var(--jarak-8);
		align-items: start;
	}
	.judul-bagian {
		font-size: var(--teks-isi);
		margin-bottom: var(--jarak-3);
	}
	.nowrap {
		white-space: nowrap;
	}
	.berkurang {
		color: var(--waspada);
		font-weight: 500;
	}
	tr.berjalan td {
		background: color-mix(in srgb, var(--nila-tipis) 50%, transparent);
	}
	.tanda {
		margin-left: var(--jarak-2);
		padding: 1px 6px;
		border-radius: var(--radius-kecil);
		background: color-mix(in srgb, var(--kertas), var(--garis) 50%);
		color: var(--tinta-2);
		font-size: var(--teks-mini);
		font-weight: 500;
	}
	.redup {
		color: var(--tinta-2);
	}
	.kecil {
		font-size: var(--teks-kecil);
	}
	@media (max-width: 1023px) {
		.dua-kolom,
		.strip,
		.angka-grid {
			grid-template-columns: 1fr 1fr;
		}
		.strip > div:nth-child(2) {
			border-right: 0;
		}
	}
	@media (max-width: 767px) {
		.dua-kolom,
		.angka-grid {
			grid-template-columns: 1fr;
		}
		.alat {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
