import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { beforeEach, describe, expect, it } from 'vitest';
import { addDays } from '../calc/calendar.ts';
import { DEFAULT_SETTINGS } from '../calc/settings.ts';
import { computeDraft } from '../estimate.ts';
import { openDb, type Db } from './db/index.ts';
import { estimates } from './db/schema.ts';
import { createEstimate, deleteEstimate, finalizeEstimate, getEstimate, saveEstimate } from './estimates.ts';
import { createRole, loadOfficialHolidays } from './master.ts';
import {
	ScheduleError,
	dealProspect,
	deleteActivity,
	getProject,
	listProjects,
	projectIdForProspect,
	resetSchedule,
	saveActivity,
	updateFeatureSchedule
} from './projects.ts';
import { StatusChangeError, changeStatus, createProspect, deleteProspect, getProspect } from './prospects.ts';

let db: Db;
let prospectId: number;
let BE: number, PM: number;

beforeEach(() => {
	db = openDb(':memory:');
	migrate(db, { migrationsFolder: 'drizzle' });
	loadOfficialHolidays(db);
	BE = createRole(db, { name: 'Backend', level: null, source: 'internal' }, { monthlyRate: 15_000_000, effectiveFrom: '2026-01-01' });
	PM = createRole(db, { name: 'PM', level: null, source: 'internal' }, { monthlyRate: 18_000_000, effectiveFrom: '2026-01-01' });
	prospectId = createProspect(db, { name: 'Kasir', client: 'Toko Maju', contact: '', needs: '', businessGoal: '', deadline: null, budget: null, notes: '' });
	createEstimate(db, prospectId, '2026-11-26');
	saveEstimate(db, getEstimate(db, prospectId, 1)!.id, {
		settings: DEFAULT_SETTINGS,
		assumptions: 'API klien tersedia\n- Desain dari klien',
		exclusions: 'Migrasi data',
		risks: 'Sandbox bank tidak stabil',
		plannedStart: '2027-07-05', // dua sprint pertama tanpa libur
		// E ≈ 188 jam Backend: mulai Juli 2 sprint pengembangan, mulai Lebaran 3.
		features: [{ module: 'Kasir', name: 'Transaksi', description: '', priority: 'must', assumptions: '', efforts: { [BE]: { o: 150, m: 180, p: 260 } } }],
		team: [
			{ roleId: BE, mp: 2, months: null },
			{ roleId: PM, mp: 0.5, months: null }
		],
		overhead: []
	});
	finalizeEstimate(db, prospectId, 1);
});

describe('Deal menjadi proyek', () => {
	it('membuat proyek dengan baseline beku, rencana sprint bertanggal, dan RAID dari asumsi/risiko', () => {
		const id = dealProspect(db, prospectId, '2027-03-08');
		const p = getProject(db, id)!;
		expect(getProspect(db, prospectId)!.prospect.status).toBe('deal');
		expect(getProspect(db, prospectId)!.history[0]).toMatchObject({ from: 'estimasi', to: 'deal', note: 'Proyek dibuat dari estimasi v1' });

		// Angka baseline sama dengan perhitungan estimasi final dengan tanggal mulai proyek.
		const e = getEstimate(db, prospectId, 1)!;
		const expected = computeDraft({ ...e.draft, plannedStart: '2027-03-08' }, e.rates, e.holidays).likely;
		expect(p.project.baseline).toMatchObject({
			estimateVersion: 1,
			totalSprints: expected.sprint.totalSprints,
			price: expected.cost.price,
			total: expected.cost.total
		});
		expect(p.project.baseline.team.map((t) => [t.name, t.mp])).toEqual([['Backend', 2], ['PM', 0.5]]);

		// Mulai saat Lebaran 2027: lebih banyak sprint daripada rencana Juli di estimasi.
		const july = computeDraft(e.draft, e.rates, e.holidays).likely.sprint.totalSprints;
		expect(july).toBe(3);
		expect(p.project.baseline.totalSprints).toBe(4);

		expect(p.sprints.map((s) => [s.number, s.startDate, s.endDate])[0]).toEqual([1, '2027-03-08', '2027-03-21']);
		expect(p.sprints).toHaveLength(p.project.baseline.totalSprints);
		expect(p.sprints.at(-1)!.plan).toBe('Stabilisasi/UAT');
		expect(p.project.baseline.endDate <= p.sprints.at(-1)!.endDate).toBe(true);

		expect(p.raid.map((r) => [r.type, r.description])).toEqual([
			['assumption', 'API klien tersedia'],
			['assumption', 'Desain dari klien'],
			['risk', 'Sandbox bank tidak stabil']
		]);
		expect(projectIdForProspect(db, prospectId)).toBe(id);
		expect(listProjects(db).map((x) => x.name)).toEqual(['Kasir']);
	});

	it('baseline beku: tidak berubah walau data estimasinya berubah di database', () => {
		const id = dealProspect(db, prospectId, '2027-03-08');
		const before = getProject(db, id)!.project.baseline;
		db.update(estimates).set({ rates: [], holidays: [] }).run();
		expect(getProject(db, id)!.project.baseline).toEqual(before);
	});

	it('menolak tanggal tidak valid, tanpa versi final, dan Deal ganda; tanpa efek samping', () => {
		expect(() => dealProspect(db, prospectId, '')).toThrow(/tanggal mulai/);
		expect(() => dealProspect(db, prospectId, '2027-13-45')).toThrow(/tanggal mulai/);
		expect(() => changeStatus(db, prospectId, 'deal')).toThrow(/tanggal mulai/);

		const other = createProspect(db, { name: 'Lain', client: '', contact: '', needs: '', businessGoal: '', deadline: null, budget: null, notes: '' });
		expect(() => dealProspect(db, other, '2027-03-08')).toThrow(/final/);
		expect(listProjects(db)).toHaveLength(0);

		dealProspect(db, prospectId, '2027-03-08');
		expect(() => dealProspect(db, prospectId, '2027-04-05')).toThrow(StatusChangeError);
		expect(listProjects(db)).toHaveLength(1);
	});

	it('setelah Deal: prospek dan versi baseline terlindungi dari penghapusan', () => {
		dealProspect(db, prospectId, '2027-03-08');
		expect(() => deleteProspect(db, prospectId)).toThrow(/Deal/);
		expect(() => deleteEstimate(db, prospectId, 1)).toThrow(/baseline/);
	});
});

describe('jadwal fitur (Gantt)', () => {
	it('dibuat saat Deal: baseline = rencana, sejalan dengan sprint pengembangan', () => {
		const id = dealProspect(db, prospectId, '2027-03-08');
		const p = getProject(db, id)!;
		expect(p.schedule).toHaveLength(1);
		const row = p.schedule[0];
		expect(row).toMatchObject({ name: 'Transaksi', progress: 0, planStart: row.baselineStart, planEnd: row.baselineEnd });
		expect(row.planEnd).toBe(p.project.baseline.devSprints);
	});

	it('rencana dan progres bisa diubah dengan validasi; baseline tetap; reset mengembalikan rencana', () => {
		const id = dealProspect(db, prospectId, '2027-03-08');
		const f = getProject(db, id)!.schedule[0];
		updateFeatureSchedule(db, id, f.featureId, { planStart: 2, planEnd: 5, progress: 40 });
		const after = getProject(db, id)!.schedule[0];
		expect(after).toMatchObject({ planStart: 2, planEnd: 5, progress: 40, baselineStart: f.baselineStart, baselineEnd: f.baselineEnd });
		expect(after.updatedAt).toBeInstanceOf(Date);

		expect(() => updateFeatureSchedule(db, id, f.featureId, { planStart: 4, planEnd: 2, progress: 0 })).toThrow(ScheduleError);
		expect(() => updateFeatureSchedule(db, id, f.featureId, { planStart: 1, planEnd: 99, progress: 0 })).toThrow(/antara 1/);
		expect(() => updateFeatureSchedule(db, id, f.featureId, { planStart: 1, planEnd: 2, progress: 101 })).toThrow(/0–100/);
		expect(() => updateFeatureSchedule(db, id, 9999, { planStart: 1, planEnd: 2, progress: 0 })).toThrow(/tidak ada/);

		resetSchedule(db, id);
		expect(getProject(db, id)!.schedule[0]).toMatchObject({ planStart: f.baselineStart, planEnd: f.baselineEnd, progress: 40 });
	});
});

describe('aktivitas & milestone', () => {
	it('templat: kick-off, sprint pengembangan, SIT dan UAT di sprint stabilisasi, go-live', () => {
		const id = dealProspect(db, prospectId, '2027-07-05');
		const p = getProject(db, id)!;
		const b = p.project.baseline;
		const acts = p.activities.map((a) => [a.name, a.kind, a.startDate, a.endDate]);
		expect(acts[0]).toEqual(['Kick-off proyek', 'milestone', '2027-07-05', '2027-07-05']);
		expect(acts.find(([n]) => n === 'Sprint 1')?.[3]).toBe('2027-07-16'); // Jumat, bukan Minggu 18 Jul
		expect(acts.filter(([n]) => String(n).startsWith('Sprint '))).toHaveLength(b.devSprints);
		const stabStart = p.sprints[b.devSprints].startDate; // sprint stabilisasi pertama
		expect(acts.find(([n]) => n === 'SIT')).toEqual(['SIT', 'aktivitas', stabStart, addDays(stabStart, 4)]); // Senin–Jumat minggu pertama
		expect(acts.find(([n]) => n === 'UAT')?.[3]).toBe(b.endDate); // hari kerja terakhir, sama dengan baseline
		expect(acts.at(-1)).toEqual(['Go-live', 'milestone', b.endDate, b.endDate]);
		// Tidak ada aktivitas templat yang berakhir di akhir pekan, jadi rencana = baseline.
		expect(p.activities.every((a) => ![0, 6].includes(new Date(a.endDate + 'T00:00:00Z').getUTCDay()))).toBe(true);
	});

	it('tambah, ubah, tandai selesai, hapus dengan validasi', () => {
		const id = dealProspect(db, prospectId, '2027-07-05');
		const actId = saveActivity(db, id, null, { name: ' Pelatihan pengguna ', kind: 'aktivitas', startDate: '2027-08-09', endDate: '2027-08-13', done: false });
		expect(getProject(db, id)!.activities.find((a) => a.id === actId)).toMatchObject({ name: 'Pelatihan pengguna', endDate: '2027-08-13', done: false });

		// Milestone: tanggal selesai mengikuti tanggal mulai
		saveActivity(db, id, actId, { name: 'Serah terima', kind: 'milestone', startDate: '2027-08-20', endDate: '2027-09-30', done: true });
		expect(getProject(db, id)!.activities.find((a) => a.id === actId)).toMatchObject({ kind: 'milestone', startDate: '2027-08-20', endDate: '2027-08-20', done: true });

		const bad = (over: object) => () => saveActivity(db, id, actId, { name: 'X', kind: 'aktivitas', startDate: '2027-08-09', endDate: '2027-08-13', done: false, ...over });
		expect(bad({ name: '  ' })).toThrow(/Nama/);
		expect(bad({ endDate: '2027-08-01' })).toThrow(/sebelum tanggal mulai/);
		expect(bad({ startDate: '2027-06-01', endDate: '2027-06-02' })).toThrow(/sebelum proyek dimulai/);
		expect(bad({ startDate: '2027-08-09', endDate: '2030-01-01' })).toThrow(/terlalu jauh/);
		expect(() => saveActivity(db, id, 99999, { name: 'X', kind: 'aktivitas', startDate: '2027-08-09', endDate: '2027-08-13', done: false })).toThrow(ScheduleError);

		deleteActivity(db, id, actId);
		expect(getProject(db, id)!.activities.some((a) => a.id === actId)).toBe(false);
	});
});
