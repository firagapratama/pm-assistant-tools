import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../calc/settings.ts';
import { scopeChange } from '../change-request.ts';
import { projectStatus, statusInputFrom } from '../project-status.ts';
import { buildReport, weekOf } from '../report.ts';
import { CrError, decideChangeRequest, deleteChangeRequest, saveChangeRequest } from './change-requests.ts';
import { openDb, type Db } from './db/index.ts';
import { createEstimate, finalizeEstimate, getEstimate, saveEstimate } from './estimates.ts';
import { createRole, loadOfficialHolidays } from './master.ts';
import { dealProspect, getProject, updateFeatureSchedule } from './projects.ts';
import { createProspect } from './prospects.ts';

let db: Db;
let projectId: number;
let BE: number;
const cr = (o: number, m: number, p: number) => ({
	title: 'Tambah laporan stok',
	description: '',
	requester: 'Klien',
	requestDate: '2027-07-10',
	reason: 'Kebutuhan gudang',
	efforts: { [BE]: { o, m, p } }
});
const decide = (status: 'disetujui' | 'ditolak') => ({ status, approver: 'Direktur', decisionDate: '2027-07-12', note: '' });

beforeEach(() => {
	db = openDb(':memory:');
	migrate(db, { migrationsFolder: 'drizzle' });
	loadOfficialHolidays(db);
	BE = createRole(db, { name: 'Backend', level: null, source: 'internal' }, { monthlyRate: 15_000_000, effectiveFrom: '2026-01-01' });
	const prospectId = createProspect(db, { name: 'Kasir', client: '', contact: '', needs: '', businessGoal: '', deadline: null, budget: null, notes: '' });
	createEstimate(db, prospectId, '2026-11-26');
	saveEstimate(db, getEstimate(db, prospectId, 1)!.id, {
		settings: DEFAULT_SETTINGS,
		assumptions: '',
		exclusions: '',
		risks: '',
		plannedStart: null,
		features: [{ module: 'Kasir', name: 'Transaksi', description: '', priority: 'must', assumptions: '', efforts: { [BE]: { o: 80, m: 96, p: 120 } } }],
		team: [{ roleId: BE, mp: 1, months: null }],
		overhead: []
	});
	finalizeEstimate(db, prospectId, 1);
	projectId = dealProspect(db, prospectId, '2027-07-05');
});

describe('change request', () => {
	it('validasi: judul, tanggal, effort hanya untuk peran di tim', () => {
		expect(() => saveChangeRequest(db, projectId, null, { ...cr(1, 2, 3), title: ' ' })).toThrow(/Judul/);
		expect(() => saveChangeRequest(db, projectId, null, { ...cr(1, 2, 3), requestDate: '2027-13-01' })).toThrow(/Tanggal/);
		expect(() => saveChangeRequest(db, projectId, null, { ...cr(0, 0, 0) })).toThrow(/minimal/);
		expect(() => saveChangeRequest(db, projectId, null, { ...cr(5, 2, 3) })).toThrow(/optimis/);
		expect(() => saveChangeRequest(db, projectId, null, { ...cr(1, 2, 3), efforts: { 999: { o: 1, m: 2, p: 3 } } })).toThrow(/tim proyek/);
	});

	it('disetujui: dampak dibekukan, masuk jadwal, target selesai bergeser; keputusan final', () => {
		const id = saveChangeRequest(db, projectId, null, cr(80, 96, 120)); // ≈ effort baseline → +100%
		expect(getProject(db, projectId)!.changeRequests[0]).toMatchObject({ number: 1, status: 'diajukan', impact: null });
		const impact = decideChangeRequest(db, projectId, id, decide('disetujui'));
		expect(impact.effortHours).toBeCloseTo(97.33, 1);
		expect(impact.sprints).toBeGreaterThan(0);
		expect(impact.price).toBeGreaterThan(0);

		const p = getProject(db, projectId)!;
		expect(p.changeRequests[0]).toMatchObject({ status: 'disetujui', approver: 'Direktur', impact });
		const row = p.schedule.find((r) => r.changeRequestId === id)!;
		expect(row).toMatchObject({ key: `c${id}`, module: 'Change request', name: 'CR-1 Tambah laporan stok', progress: 0 });
		expect(row.planStart).toBe(Math.max(...p.schedule.filter((r) => r.featureId).map((r) => r.planEnd)) + 1);
		updateFeatureSchedule(db, projectId, row.key, { planStart: row.planStart, planEnd: row.planEnd, progress: 50 });

		const st = projectStatus(statusInputFrom(getProject(db, projectId)!, '2027-07-05'));
		expect(st.targetEnd > p.project.baseline.endDate).toBe(true);
		expect(st.slipDays).toBe(0); // tambahan scope yang disetujui bukan keterlambatan
		expect(scopeChange(p.project.baseline, [impact]).effortPct).toBeCloseTo(100, 0);

		const rep = buildReport(statusInputFrom(getProject(db, projectId)!, '2027-07-12'), weekOf('2027-07-12'));
		expect(rep.changeRequests).toEqual([expect.objectContaining({ label: 'CR-1', status: 'disetujui', sprints: impact.sprints, decisionDate: '2027-07-12' })]);
		expect(rep.scope).toMatchObject({ count: 1, sprints: impact.sprints });

		expect(() => saveChangeRequest(db, projectId, id, cr(1, 2, 3))).toThrow(CrError);
		expect(() => decideChangeRequest(db, projectId, id, decide('ditolak'))).toThrow(/sudah diputuskan/);
		expect(() => deleteChangeRequest(db, projectId, id)).toThrow(/sudah diputuskan/);
	});

	it('ditolak tidak mengubah jadwal; CR kedua dihitung di atas yang disetujui', () => {
		const a = saveChangeRequest(db, projectId, null, cr(8, 10, 12));
		const b = saveChangeRequest(db, projectId, null, { ...cr(8, 10, 12), title: 'Ekspor Excel' });
		expect(() => decideChangeRequest(db, projectId, a, { ...decide('disetujui'), approver: '' })).toThrow(/penyetuju/);
		expect(() => decideChangeRequest(db, projectId, a, { ...decide('disetujui'), decisionDate: '2027-07-01' })).toThrow(/sebelum/);
		decideChangeRequest(db, projectId, a, decide('ditolak'));
		expect(getProject(db, projectId)!.schedule.some((r) => r.changeRequestId === a)).toBe(false);
		saveChangeRequest(db, projectId, b, { ...cr(16, 20, 24), title: 'Ekspor Excel' });
		expect(decideChangeRequest(db, projectId, b, decide('disetujui')).effortHours).toBeCloseTo(20, 5);
		const c = saveChangeRequest(db, projectId, null, cr(1, 1, 1));
		expect(getProject(db, projectId)!.changeRequests.map((x) => x.number)).toEqual([3, 2, 1]);
		deleteChangeRequest(db, projectId, c);
		expect(getProject(db, projectId)!.changeRequests).toHaveLength(2);
	});
});
