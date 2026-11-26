<script lang="ts">
	// Laporan status mingguan (PRD F14): data otomatis + narasi PM; terkirim = diarsipkan, tidak bisa diubah.
	import { untrack } from 'svelte';
	import { Check, FileText, LoaderCircle, Plus, Send, Trash2 } from '@lucide/svelte';
	import { date, decimal } from '#lib/format/index.ts';
	import { HEALTH_LABEL, statusInputFrom, type StatusInput } from '#lib/project-status.ts';
	import { buildReport, weekOf, type ReportData } from '#lib/report.ts';
	import type { ProjectBaseline } from '#lib/project.ts';
	import type { EstimateSettings } from '#lib/calc/settings.ts';
	import type { Holiday } from '#lib/calc/calendar.ts';

	interface Report {
		id: number;
		periodStart: string;
		periodEnd: string;
		achievements: string;
		obstacles: string;
		nextWeek: string;
		helpNeeded: string;
		snapshot: ReportData | null;
		sentAt: Date | null;
	}

	let {
		data,
		today,
		post
	}: {
		data: {
			reports: Report[];
			project: { startDate: string; baseline: ProjectBaseline };
			estimate: { draft: { settings: EstimateSettings }; holidays: Holiday[] };
			schedule: StatusInput['schedule'];
			activities: StatusInput['activities'];
			raid: StatusInput['raid'];
		};
		today: string;
		post: (action: string, fields: Record<string, string | number | boolean>) => Promise<Record<string, unknown> | null | undefined>;
	} = $props();

	let week = $derived(weekOf(today));
	let thisWeek = $derived(data.reports.find((r) => r.periodStart === week.start));
	// svelte-ignore state_referenced_locally — pilihan awal: laporan terbaru.
	let selectedId: number | null = $state(data.reports[0]?.id ?? null);
	let report = $derived(data.reports.find((r) => r.id === selectedId) ?? null);
	let sent = $derived(!!report?.sentAt);
	/** Draf: dihitung langsung; terkirim: snapshot yang dibekukan. */
	let content: ReportData | null = $derived(
		report ? (report.snapshot ?? buildReport(statusInputFrom(data, today), { start: report.periodStart, end: report.periodEnd })) : null
	);
	const period = (r: { periodStart: string; periodEnd: string }) => `${date(r.periodStart).replace(/ \d{4}$/, '')} – ${date(r.periodEnd)}`;

	// ── Narasi (simpan otomatis) ──
	const FIELDS = [
		{ key: 'achievements', label: 'Pencapaian minggu ini' },
		{ key: 'obstacles', label: 'Kendala' },
		{ key: 'nextWeek', label: 'Rencana minggu depan' },
		{ key: 'helpNeeded', label: 'Bantuan yang dibutuhkan' }
	] as const;
	let narrative = $state({ achievements: '', obstacles: '', nextWeek: '', helpNeeded: '' });
	let saveState: 'tersimpan' | 'menyimpan' | 'belum' = $state('tersimpan');
	let timer: ReturnType<typeof setTimeout> | undefined;

	// Isi narasi hanya saat laporan yang dipilih berganti (bukan setiap data dimuat ulang).
	$effect(() => {
		const id = selectedId;
		untrack(() => {
			const r = data.reports.find((x) => x.id === id);
			narrative = r
				? { achievements: r.achievements, obstacles: r.obstacles, nextWeek: r.nextWeek, helpNeeded: r.helpNeeded }
				: { achievements: '', obstacles: '', nextWeek: '', helpNeeded: '' };
			saveState = 'tersimpan';
		});
	});

	function changed() {
		saveState = 'belum';
		clearTimeout(timer);
		const id = selectedId;
		timer = setTimeout(async () => {
			if (id === null) return;
			saveState = 'menyimpan';
			await post('saveNarrative', { id, ...narrative });
			saveState = 'tersimpan';
		}, 800);
	}

	async function create() {
		const res = await post('createReport', {});
		if (typeof res?.reportId === 'number') selectedId = res.reportId;
	}

	async function markSent() {
		if (!report) return;
		clearTimeout(timer);
		await post('saveNarrative', { id: report.id, ...narrative });
		await post('sendReport', { id: report.id });
	}

	async function removeDraft() {
		if (!report) return;
		await post('deleteReport', { id: report.id });
		selectedId = data.reports.find((r) => r.id !== report?.id)?.id ?? null;
	}
</script>

<div class="laporan-tata">
	<aside class="daftar" aria-label="Daftar laporan">
		{#if !thisWeek}
			<button class="btn baru" onclick={create}><Plus size={16} strokeWidth={2} aria-hidden="true" /> Buat laporan minggu ini</button>
		{/if}
		{#if data.reports.length === 0}
			<p class="kosong kecil">Belum ada laporan. Data proyek terisi otomatis; Anda tinggal menulis narasinya.</p>
		{:else}
			<ul>
				{#each data.reports as r (r.id)}
					<li>
						<button aria-current={r.id === selectedId ? 'true' : undefined} onclick={() => (selectedId = r.id)}>
							<span class="minggu">{period(r)}</span>
							{#if r.sentAt}
								<span class="badge final">Terkirim {date(r.sentAt)}</span>
							{:else}
								<span class="badge draft">Draf</span>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</aside>

	{#if report && content}
		<section class="isi-laporan" aria-label="Laporan {period(report)}">
			<div class="kepala">
				<div>
					<h2>Laporan {period(report)}</h2>
					<p class="kecil redup">
						{sent
							? `Terkirim ${date(report.sentAt!)} · data dibekukan per ${date(content.generatedOn)}; tidak dapat diubah`
							: `Draf · data otomatis per hari ini (${date(today)}) dan dibekukan saat ditandai terkirim`}
					</p>
				</div>
				<div class="tombol">
					<a class="btn kecil" href="/cetak/laporan/{report.id}?template=direksi"><FileText size={14} strokeWidth={1.75} aria-hidden="true" /> Direksi</a>
					<a class="btn kecil" href="/cetak/laporan/{report.id}?template=teknis"><FileText size={14} strokeWidth={1.75} aria-hidden="true" /> Teknis</a>
					{#if !sent}
						<button class="btn kecil" onclick={markSent}><Send size={14} strokeWidth={1.75} aria-hidden="true" /> Tandai terkirim</button>
						<button class="btn teks kecil" aria-label="Hapus draf" onclick={removeDraft}><Trash2 size={14} strokeWidth={1.75} /></button>
					{/if}
				</div>
			</div>

			<div class="panel otomatis">
				<div class="status-baris">
					<span class="badge kesehatan {content.health}">{HEALTH_LABEL[content.health]}</span>
					<span>{content.reasons.length ? content.reasons.join(' · ') : 'Jadwal dan risiko sesuai rencana.'}</span>
				</div>
				<dl>
					<dt>Progres</dt>
					<dd>{decimal(content.progress.overall, 0)}% <span class="redup">(rencana {decimal(content.progress.expected, 0)}%)</span></dd>
					<dt>Fitur</dt>
					<dd>{content.features.done} selesai · {content.features.inProgress} berjalan · {content.features.notStarted} belum dari {content.features.total}</dd>
					<dt>Selesai (rencana)</dt>
					<dd>
						{date(content.plannedEnd)}
						<span class="redup">{content.slipDays > 0 ? `· ${content.slipDays} hari setelah baseline` : '· sesuai baseline'}</span>
					</dd>
					<dt>RAID</dt>
					<dd>
						{content.openRaid.filter((r) => r.severity === 'tinggi').length} risiko tinggi terbuka · {content.openRaid.length} item terbuka ·
						{content.newRaidThisWeek} baru minggu ini
					</dd>
				</dl>
				{#if content.upcoming.length}
					<h3>Aktivitas minggu ini dan depan</h3>
					<ul class="mini">
						{#each content.upcoming as a, i (i)}
							<li>
								{#if a.done}<Check size={12} strokeWidth={2.5} aria-label="selesai" />{/if}
								{a.kind === 'milestone' ? '◆ ' : ''}{a.name}
								<span class="redup">{a.kind === 'milestone' ? date(a.startDate) : `${date(a.startDate)} – ${date(a.endDate)}`}</span>
							</li>
						{/each}
					</ul>
				{/if}
				{#if content.late.length}
					<h3>Terlambat</h3>
					<ul class="mini">
						{#each content.late as l, i (i)}<li>{l.name} <span class="redup">({l.kind}, rencana {date(l.endDate)})</span></li>{/each}
					</ul>
				{/if}
			</div>

			<div class="narasi">
				<div class="narasi-kepala">
					<h3>Narasi</h3>
					{#if !sent}
						<span class="kecil redup simpan">
							{#if saveState === 'tersimpan'}<Check size={12} strokeWidth={2} aria-hidden="true" /> Tersimpan{:else}<LoaderCircle size={12} strokeWidth={2} class="putar" aria-hidden="true" /> Menyimpan…{/if}
						</span>
					{/if}
				</div>
				{#each FIELDS as f (f.key)}
					<label class="field">
						<span class="field-label">{f.label}</span>
						{#if sent}
							<p class="terkunci">{report[f.key] || '–'}</p>
						{:else}
							<textarea rows="3" bind:value={narrative[f.key]} oninput={changed}></textarea>
						{/if}
					</label>
				{/each}
			</div>
		</section>
	{:else}
		<div class="kosong-blok">
			<strong>Laporan status mingguan</strong>
			<p>Status kesehatan, progres, aktivitas, keterlambatan, dan risiko terisi otomatis. Tambahkan narasi, cetak untuk direksi atau tim teknis, lalu tandai terkirim.</p>
		</div>
	{/if}
</div>

<style>
	.laporan-tata {
		display: grid;
		grid-template-columns: 240px minmax(0, 1fr);
		gap: var(--jarak-6);
		align-items: start;
	}
	.daftar {
		display: grid;
		gap: var(--jarak-3);
	}
	.baru {
		width: 100%;
	}
	.daftar ul {
		list-style: none;
		margin: 0;
		padding: 0;
		border: 1px solid var(--garis);
		border-radius: var(--radius-panel);
		background: var(--permukaan);
		overflow: hidden;
	}
	.daftar li + li {
		border-top: 1px solid var(--garis);
	}
	.daftar li button {
		display: grid;
		gap: 4px;
		justify-items: start;
		width: 100%;
		padding: var(--jarak-3) var(--jarak-4);
		border: 0;
		border-left: 2px solid transparent;
		background: none;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.daftar li button:hover {
		background: color-mix(in srgb, var(--nila-tipis) 40%, transparent);
	}
	.daftar li button[aria-current='true'] {
		border-left-color: var(--nila);
		background: color-mix(in srgb, var(--nila-tipis) 60%, transparent);
	}
	.minggu {
		font-weight: 500;
		font-size: var(--teks-kecil);
	}
	.isi-laporan {
		display: grid;
		gap: var(--jarak-6);
	}
	.kepala {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--jarak-4);
		flex-wrap: wrap;
	}
	.kepala h2 {
		font-size: var(--teks-h3);
	}
	.kepala p {
		margin: var(--jarak-1) 0 0;
	}
	.tombol {
		display: flex;
		gap: var(--jarak-2);
		flex-wrap: wrap;
	}
	.otomatis {
		padding: var(--jarak-4) var(--jarak-6);
	}
	.status-baris {
		display: flex;
		align-items: center;
		gap: var(--jarak-3);
		flex-wrap: wrap;
		padding-bottom: var(--jarak-3);
		margin-bottom: var(--jarak-3);
		border-bottom: 1px solid var(--garis);
		font-size: var(--teks-kecil);
	}
	.kesehatan.hijau { background: var(--aman-tipis); color: var(--aman); }
	.kesehatan.kuning { background: var(--waspada-tipis); color: var(--waspada); }
	.kesehatan.kuning::before { background: var(--waspada-ikon); }
	.kesehatan.merah { background: var(--kritis-tipis); color: var(--kritis); }
	dl {
		display: grid;
		grid-template-columns: 140px 1fr;
		gap: var(--jarak-2) var(--jarak-4);
		margin: 0;
		font-size: var(--teks-kecil);
	}
	dt {
		color: var(--tinta-2);
	}
	dd {
		margin: 0;
	}
	.otomatis h3,
	.narasi h3 {
		margin: var(--jarak-4) 0 var(--jarak-1);
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.mini {
		margin: 0;
		padding-left: 1.1em;
		font-size: var(--teks-kecil);
	}
	.narasi {
		display: grid;
		gap: var(--jarak-4);
	}
	.narasi-kepala {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.narasi-kepala h3 {
		margin: 0;
	}
	.simpan {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.simpan :global(.putar) {
		animation: putar 1s linear infinite;
	}
	@keyframes putar {
		to {
			transform: rotate(360deg);
		}
	}
	.terkunci {
		margin: 0;
		padding: var(--jarak-3) var(--jarak-4);
		border-radius: var(--radius-kecil);
		background: var(--permukaan);
		border: 1px solid var(--garis);
		white-space: pre-line;
		font-size: var(--teks-kecil);
	}
	.kecil {
		font-size: var(--teks-kecil);
	}
	.redup {
		color: var(--tinta-2);
	}
	@media (max-width: 1023px) {
		.laporan-tata {
			grid-template-columns: 1fr;
		}
	}
</style>
