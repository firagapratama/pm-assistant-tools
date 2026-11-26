import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { beforeEach, describe, expect, it } from 'vitest';
import { addDays } from '../calc/calendar.ts';
import { DEFAULT_SETTINGS } from '../calc/settings.ts';
import { projectStatus, statusInputFrom } from '../project-status.ts';
import { HIGH_RISK, raidScore, reviewOverdue, severity } from '../raid.ts';
import { weekOf } from '../report.ts';
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
		updateFeatureSchedule(db, projectId, f.featureId, { planStart: f.planStart, planEnd: f.planEnd + 3, progress: 0 });
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
