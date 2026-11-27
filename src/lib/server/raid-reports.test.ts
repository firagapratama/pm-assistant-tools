import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { beforeEach, describe, expect, it } from 'vitest';
import { addDays } from '../calc/calendar.ts';
import { DEFAULT_SETTINGS } from '../calc/settings.ts';
import { projectStatus, statusInputFrom } from '../project-status.ts';
import { HIGH_RISK, raidScore, reviewOverdue, severity } from '../raid.ts';
import { weekOf } from '../report.ts';
import { dashboardData } from './dashboard.ts';
import { deleteAvailability, saveAvailability } from './availability.ts';
import { openDb, type Db } from './db/index.ts';
import { createEstimate, finalizeEstimate, getEstimate, saveEstimate } from './estimates.ts';
import { createRole, loadOfficialHolidays } from './master.ts';
import { dealProspect, getProject, projectDashboard, saveActivity, setHealthOverride, updateFeatureSchedule } from './projects.ts';
import { createProspect } from './prospects.ts';
import { RaidError, deleteRaid, saveRaid } from './raid.ts';
import { ReportError, createWeeklyReport, deleteDraftReport, getReport, listReports, saveNarrative, sendReport } from './reports.ts';

let db: Db;
let projectId: number;
const risk = { type: 'risk' as const, description: 'Sandbox bank tidak stabil', owner: 'Budi', impact: 4, likelihood: 4, mitigation: '', reviewDate: null, status: 'terbuka' as const };

beforeEach(() => {
	db = openDb(':memory:');
	migrate(db, { migrationsFolder: 'drizzle' });
	loadOfficialHolidays(db);
	const BE = createRole(db, { name: 'Backend', level: null, source: 'internal' }, { monthlyRate: 15_000_000, effectiveFrom: '2026-01-01' });
	const prospectId = createProspect(db, { name: 'Kasir', client: '', contact: '', needs: '', businessGoal: '', deadline: null, budget: null, notes: '' });
	createEstimate(db, prospectId, '2026-11-26');
	saveEstimate(db, getEstimate(db, prospectId, 1)!.id, {
		settings: DEFAULT_SETTINGS,
		assumptions: 'API klien tersedia',
		exclusions: '',
		risks: '',
		plannedStart: null,
		features: [
			{ module: 'Kasir', name: 'Transaksi', description: '', priority: 'must', assumptions: '', efforts: { [BE]: { o: 80, m: 96, p: 120 } } },
			{ module: 'Laporan', name: 'Harian', description: '', priority: 'must', assumptions: '', efforts: { [BE]: { o: 40, m: 48, p: 60 } } }
		],
		team: [{ roleId: BE, mp: 1, months: null }],
		overhead: []
	});
	finalizeEstimate(db, prospectId, 1);
	projectId = dealProspect(db, prospectId, '2027-07-05');
});

const status = (today: string) => projectStatus(statusInputFrom(getProject(db, projectId)!, today));

describe('RAID', () => {
	it('skor, tingkat, lewat tinjau', () => {
		expect(raidScore(risk)).toBe(16);
		expect(severity(16)).toBe('tinggi');
		expect(severity(HIGH_RISK - 1)).toBe('sedang');
		expect(severity(4)).toBe('rendah');
		expect(raidScore({ type: 'issue', impact: 5, likelihood: 5 })).toBeNull(); // skor hanya untuk risiko
		expect(reviewOverdue({ status: 'terbuka', reviewDate: '2027-07-01' }, '2027-07-02')).toBe(true);
		expect(reviewOverdue({ status: 'selesai', reviewDate: '2027-07-01' }, '2027-07-02')).toBe(false);
	});

	it('tambah, ubah, hapus dengan validasi; kemungkinan dibuang untuk non-risiko', () => {
		const id = saveRaid(db, projectId, null, risk);
		const issueId = saveRaid(db, projectId, null, { ...risk, type: 'issue', description: 'Server staging mati', likelihood: 5 });
		const raid = getProject(db, projectId)!.raid;
		expect(raid.find((r) => r.id === issueId)).toMatchObject({ type: 'issue', likelihood: null, impact: 4 });
		saveRaid(db, projectId, id, { ...risk, mitigation: 'Siapkan mock gateway', status: 'dipantau' });
		expect(getProject(db, projectId)!.raid.find((r) => r.id === id)).toMatchObject({ mitigation: 'Siapkan mock gateway', status: 'dipantau' });
		expect(() => saveRaid(db, projectId, id, { ...risk, description: ' ' })).toThrow(RaidError);
		expect(() => saveRaid(db, projectId, id, { ...risk, impact: 6 })).toThrow(/Dampak harus 1–5/);
		expect(() => saveRaid(db, projectId, id, { ...risk, reviewDate: '2027-02-30x' })).toThrow(/tinjau/);
		expect(() => saveRaid(db, projectId, 9999, risk)).toThrow(/tidak ada/);
		deleteRaid(db, projectId, issueId);
		expect(getProject(db, projectId)!.raid.some((r) => r.id === issueId)).toBe(false);
	});
});

describe('kesehatan proyek', () => {
	it('Hijau di awal; Kuning bila ada yang terlambat; Merah bila risiko tinggi tanpa mitigasi', () => {
		expect(status('2027-07-05')).toMatchObject({ health: 'hijau', reasons: [] });

		// Setelah sprint pertama berakhir, fitur yang belum selesai terlambat.
		const later = status('2027-08-30');
		expect(later.health).toBe('kuning');
		expect(later.reasons.join(' ')).toMatch(/terlambat/);

		saveRaid(db, projectId, null, risk);
		const red = status('2027-07-05');
		expect(red.health).toBe('merah');
		expect(red.reasons[0]).toMatch(/risiko tinggi belum punya mitigasi/);
		expect(red.highRisks).toHaveLength(1);
	});

	it('Merah bila selesai mundur lebih dari 20% durasi baseline', () => {
		const f = getProject(db, projectId)!.schedule[1];
		updateFeatureSchedule(db, projectId, f.key, { planStart: f.planStart, planEnd: f.planEnd + 3, progress: 0 });
		const s = status('2027-07-05');
		expect(s.slipDays).toBeGreaterThan(0);
		expect(s.health).toBe('merah');
		expect(s.reasons[0]).toMatch(/mundur/);
	});
});

describe('laporan mingguan', () => {
	it('minggu Senin–Minggu', () => {
		expect(weekOf('2026-11-26')).toEqual({ start: '2026-11-23', end: '2026-11-29' }); // Kamis
		expect(weekOf('2026-11-23')).toEqual({ start: '2026-11-23', end: '2026-11-29' }); // Senin
		expect(weekOf('2026-11-29')).toEqual({ start: '2026-11-23', end: '2026-11-29' }); // Minggu
	});

	it('satu laporan per minggu; narasi tersimpan; terkirim membekukan data dan mengunci laporan', () => {
		const id = createWeeklyReport(db, projectId, '2027-07-08');
		expect(createWeeklyReport(db, projectId, '2027-07-11')).toBe(id); // minggu yang sama
		saveNarrative(db, projectId, id, { achievements: 'Setup selesai', obstacles: '', nextWeek: 'Mulai kasir', helpNeeded: '' });
		saveActivity(db, projectId, null, { name: 'Demo ke klien', kind: 'milestone', startDate: '2027-07-09', endDate: '2027-07-09', done: false });

		const live = status('2027-07-08'); // kick-off 5 Jul belum dicentang selesai → terlambat → Kuning
		expect(live.health).toBe('kuning');
		expect(live.reasons).toEqual(['1 fitur/aktivitas terlambat']);

		sendReport(db, projectId, id, '2027-07-08');
		const sent = getReport(db, id)!;
		expect(sent.sentAt).toBeInstanceOf(Date);
		expect(sent.snapshot).toMatchObject({ generatedOn: '2027-07-08', period: { start: '2027-07-05', end: '2027-07-11' }, health: live.health, reasons: live.reasons });
		expect(sent.snapshot!.upcoming.map((a) => a.name)).toContain('Demo ke klien');
		expect(sent.snapshot!.features).toMatchObject({ total: 2, done: 0 });

		// Data proyek berubah setelah terkirim (risiko tinggi tanpa mitigasi → Merah): snapshot tetap.
		saveRaid(db, projectId, null, risk);
		expect(status('2027-07-08').health).toBe('merah');
		expect(getReport(db, id)!.snapshot!.health).toBe('kuning');
		expect(() => saveNarrative(db, projectId, id, { achievements: 'x', obstacles: '', nextWeek: '', helpNeeded: '' })).toThrow(ReportError);
		expect(() => sendReport(db, projectId, id, '2027-07-09')).toThrow(/sudah terkirim/);
		expect(() => deleteDraftReport(db, projectId, id)).toThrow(/sudah terkirim/);

		const next = createWeeklyReport(db, projectId, '2027-07-14');
		expect(listReports(db, projectId).map((r) => r.id)).toEqual([next, id]);
		deleteDraftReport(db, projectId, next);
		expect(listReports(db, projectId)).toHaveLength(1);
	});
});

describe('dashboard kesehatan (F10)', () => {
	it('blocker > 2 hari membuat Kuning; tenggat terdekat dan sprint berjalan', () => {
		saveRaid(db, projectId, null, { ...risk, type: 'issue', description: 'Akses VPN belum ada', impact: 3 });
		const created = getProject(db, projectId)!.raid[0].createdAt.toISOString().slice(0, 10);
		const s = status(created);
		expect(s.blockers).toHaveLength(1);
		expect(s.reasons.join(' ')).not.toMatch(/blocker/);
		const later = status(addDays(created, 3));
		expect(later.reasons.join(' ')).toMatch(/1 blocker terbuka lebih dari 2 hari/);

		const s2 = status('2027-07-20');
		expect(s2.currentSprint).toBe(2);
		expect(s2.nextDue!.endDate >= '2027-07-20').toBe(true);
		expect(status('2027-07-01').currentSprint).toBe(0);
	});

	it('status manual wajib alasan, menggantikan status otomatis, dan bisa dikembalikan', () => {
		expect(() => setHealthOverride(db, projectId, { health: 'merah', reason: ' ' })).toThrow(/alasan/);
		setHealthOverride(db, projectId, { health: 'merah', reason: 'Klien menunda UAT' });
		const s = status('2027-07-05');
		expect(s).toMatchObject({ health: 'merah', autoHealth: 'hijau', override: { health: 'merah' } });
		expect(s.reasons[0]).toBe('Ditetapkan PM: Klien menunda UAT');
		expect(projectDashboard(db, '2027-07-05')[0]).toMatchObject({ health: 'merah', manual: true, totalSprints: expect.any(Number) });
		setHealthOverride(db, projectId, null);
		expect(status('2027-07-05').health).toBe('hijau');
	});
});

describe('aktivitas sprint otomatis', () => {
	it('Sprint N dicentang saat semua fitur yang selesai di sprint N 100%, dan batal bila turun lagi', () => {
		const p = getProject(db, projectId)!;
		const sprintActs = p.activities.filter((a) => a.sprintNumber !== null);
		expect(sprintActs.map((a) => a.name)).toEqual(sprintActs.map((a) => `Sprint ${a.sprintNumber}`));
		const f = p.schedule[0];
		const act = () => getProject(db, projectId)!.activities.find((a) => a.sprintNumber === f.planEnd)!;
		const sameSprint = p.schedule.filter((r) => r.planEnd === f.planEnd);

		for (const r of sameSprint) updateFeatureSchedule(db, projectId, r.key, { planStart: r.planStart, planEnd: r.planEnd, progress: 100 });
		expect(act().done).toBe(true);
		updateFeatureSchedule(db, projectId, f.key, { planStart: f.planStart, planEnd: f.planEnd, progress: 60 });
		expect(act().done).toBe(false);

		// Sprint tanpa fitur yang berakhir di sana tetap manual.
		const empty = getProject(db, projectId)!.activities.find((a) => a.sprintNumber !== null && !p.schedule.some((r) => r.planEnd === a.sprintNumber));
		if (empty) {
			saveActivity(db, projectId, empty.id, { name: empty.name, kind: empty.kind, startDate: empty.startDate, endDate: empty.endDate, done: true });
			updateFeatureSchedule(db, projectId, f.key, { planStart: f.planStart, planEnd: f.planEnd, progress: 10 });
			expect(getProject(db, projectId)!.activities.find((a) => a.id === empty.id)!.done).toBe(true);
		}
	});
});

describe('dashboard utama', () => {
	it('pipeline, kesehatan, peran, RAID, dan tenggat dari data proyek', () => {
		saveRaid(db, projectId, null, risk); // risiko tinggi tanpa mitigasi
		saveRaid(db, projectId, null, { ...risk, type: 'issue', description: 'Server staging mati' });
		const d = dashboardData(db, '2027-07-05');
		expect(d.pipeline.find((s) => s.status === 'deal')).toMatchObject({ count: 1 });
		expect(d.pipeline.find((s) => s.status === 'deal')!.value).toBeGreaterThan(0);
		expect(d.kpi).toMatchObject({ activeProjects: 1, winRate: 100, decided: 1, highRisks: 1, openPipelineCount: 0 });
		expect(d.health.find((h) => h.health === 'merah')!.count).toBe(1);
		expect(d.roles).toEqual([{ name: 'Backend', mp: 1 }]);
		expect(d.raidByType.find((r) => r.type === 'risk')).toMatchObject({ count: 1, high: 1 });
		expect(d.raidByType.find((r) => r.type === 'issue')).toMatchObject({ count: 1, high: 0 });
		expect(d.due.map((x) => x.name)).toContain('Kick-off proyek');
		expect(d.intake).toHaveLength(6);
		expect(d.intake.at(-1)!.month).toBe('2027-07');
	});
});

describe('ketersediaan tim di proyek', () => {
	it('cuti Backend memundurkan proyeksi selesai; lembur memajukan; validasi', () => {
		const before = status('2027-07-05');
		const BE = getProject(db, projectId)!.project.baseline.team[0].roleId;
		const leave = saveAvailability(db, projectId, null, { roleId: BE, kind: 'cuti', people: 1, startDate: '2027-07-12', endDate: '2027-07-16', hours: 0, note: 'Cuti keluarga' });
		const after = status('2027-07-05');
		expect(after.availability.shiftDays).toBe(5); // 1 dari 1 Backend, 5 hari kerja
		expect(after.plannedEnd > before.plannedEnd).toBe(true);
		expect(after.slipDays).toBeGreaterThan(before.slipDays);

		saveAvailability(db, projectId, null, { roleId: BE, kind: 'lembur', people: 1, startDate: '2027-07-19', endDate: '2027-07-23', hours: 6, note: '' });
		expect(status('2027-07-05').availability.shiftDays).toBe(0); // 5 hari × 6 jam = 5 hari kapasitas

		expect(() => saveAvailability(db, projectId, null, { roleId: 999, kind: 'cuti', people: 1, startDate: '2027-07-12', endDate: '2027-07-12', hours: 0, note: '' })).toThrow(/tim proyek/);
		expect(() => saveAvailability(db, projectId, null, { roleId: BE, kind: 'cuti', people: 1, startDate: '2027-07-12', endDate: '2027-07-10', hours: 0, note: '' })).toThrow(/sebelum/);
		expect(() => saveAvailability(db, projectId, null, { roleId: BE, kind: 'lembur', people: 1, startDate: '2027-07-12', endDate: '2027-07-12', hours: 0, note: '' })).toThrow(/Jam lembur/);
		deleteAvailability(db, projectId, leave);
		expect(getProject(db, projectId)!.availability).toHaveLength(1);
	});
});
