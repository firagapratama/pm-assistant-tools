import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../calc/settings.ts';
import { statusInputFrom } from '../project-status.ts';
import { buildReport, weekOf } from '../report.ts';
import { DecisionError, listDecisions, saveDecision } from './decisions.ts';
import { openDb, type Db } from './db/index.ts';
import { createEstimate, finalizeEstimate, getEstimate, saveEstimate } from './estimates.ts';
import { createRole } from './master.ts';
import { dealProspect, getProject } from './projects.ts';
import { createProspect } from './prospects.ts';

let db: Db;
let projectId: number;
const input = { date: '2027-07-06', decision: 'Pakai Midtrans untuk pembayaran', decidedBy: 'Rapat mingguan', reason: 'Biaya lebih rendah', alternatives: 'Xendit', impact: '', link: 'https://docs.example.com/notulen-1', supersedesId: null };

beforeEach(() => {
	db = openDb(':memory:');
	migrate(db, { migrationsFolder: 'drizzle' });
	const BE = createRole(db, { name: 'Backend', level: null, source: 'internal' }, { monthlyRate: 15_000_000, effectiveFrom: '2026-01-01' });
	const prospectId = createProspect(db, { name: 'Kasir', client: '', contact: '', needs: '', businessGoal: '', deadline: null, budget: null, notes: '' });
	createEstimate(db, prospectId, '2026-11-26');
	saveEstimate(db, getEstimate(db, prospectId, 1)!.id, {
		settings: DEFAULT_SETTINGS, assumptions: '', exclusions: '', risks: '', plannedStart: null,
		features: [{ module: 'Kasir', name: 'Transaksi', description: '', priority: 'must', assumptions: '', efforts: { [BE]: { o: 8, m: 10, p: 12 } } }],
		team: [{ roleId: BE, mp: 1, months: null }], overhead: []
	});
	finalizeEstimate(db, prospectId, 1);
	projectId = dealProspect(db, prospectId, '2027-07-05');
});

describe('decision log', () => {
	it('validasi isi, tanggal, tautan', () => {
		expect(() => saveDecision(db, projectId, null, { ...input, decision: ' ' })).toThrow(DecisionError);
		expect(() => saveDecision(db, projectId, null, { ...input, date: '2027-02-30x' })).toThrow(/Tanggal/);
		expect(() => saveDecision(db, projectId, null, { ...input, link: 'javascript:alert(1)' })).toThrow(/http/);
		expect(() => saveDecision(db, 999, null, input)).toThrow(/Proyek/);
	});

	it('pembatalan merujuk keputusan lama; satu keputusan hanya bisa dibatalkan sekali; muncul di laporan', () => {
		const k1 = saveDecision(db, projectId, null, input);
		expect(() => saveDecision(db, projectId, null, { ...input, date: '2027-07-01', supersedesId: k1 })).toThrow(/sebelum/);
		const k2 = saveDecision(db, projectId, null, { ...input, date: '2027-07-08', decision: 'Ganti ke Xendit', supersedesId: k1 });
		expect(() => saveDecision(db, projectId, null, { ...input, date: '2027-07-09', supersedesId: k1 })).toThrow(/sudah dibatalkan/);
		const list = listDecisions(db, projectId);
		expect(list.map((d) => d.number)).toEqual([2, 1]);
		expect(list.find((d) => d.id === k1)).toMatchObject({ supersededByNumber: 2, supersedesNumber: null });
		expect(list.find((d) => d.id === k2)).toMatchObject({ supersedesNumber: 1, supersededByNumber: null });

		// Perbaikan isi tidak mengubah rujukan.
		saveDecision(db, projectId, k2, { ...input, date: '2027-07-08', decision: 'Ganti ke Xendit (QRIS)', supersedesId: null });
		expect(listDecisions(db, projectId)[0]).toMatchObject({ decision: 'Ganti ke Xendit (QRIS)', supersedesNumber: 1 });

		const rep = buildReport(statusInputFrom(getProject(db, projectId)!, '2027-07-08'), weekOf('2027-07-08'));
		expect(rep.decisions).toEqual([
			expect.objectContaining({ label: 'K-1', supersedes: null }),
			expect.objectContaining({ label: 'K-2', supersedes: 'K-1', decision: 'Ganti ke Xendit (QRIS)' })
		]);
	});
});
