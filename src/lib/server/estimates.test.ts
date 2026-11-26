import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as v from 'valibot';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../calc/settings.ts';
import { EstimateDraftSchema, type EstimateDraft } from '../validation/estimate.ts';
import { openDb, type Db } from './db/index.ts';
import { estimateFeatures } from './db/schema.ts';
import {
	EstimateError,
	createEstimate,
	deleteEstimate,
	finalizeEstimate,
	getEstimate,
	listEstimates,
	refreshRates,
	saveEstimate
} from './estimates.ts';
import { createRole, getAiEnabled, listAiCalls, loadOfficialHolidays, logAiCall, saveSettings, setAiEnabled, setHoliday, setRate, setRoleActive } from './master.ts';
import { computeDraft } from '../estimate.ts';
import { changeStatus, createProspect, getProspect } from './prospects.ts';
import { dealProspect } from './projects.ts';

let db: Db;
let prospectId: number;
let BE: number, QA: number;
const today = '2026-11-26';

beforeEach(() => {
	db = openDb(':memory:');
	migrate(db, { migrationsFolder: 'drizzle' });
	BE = createRole(db, { name: 'Backend', level: null, source: 'internal' }, { monthlyRate: 15_000_000, effectiveFrom: '2026-01-01' });
	QA = createRole(db, { name: 'QA', level: null, source: 'internal' });
	prospectId = createProspect(db, { name: 'Kasir', client: '', contact: '', needs: '', businessGoal: '', deadline: null, budget: null, notes: '' });
});

const draftWith = (over: Partial<EstimateDraft> = {}): EstimateDraft => ({
	settings: DEFAULT_SETTINGS,
	assumptions: '',
	exclusions: '',
	risks: '',
	plannedStart: null,
	features: [
		{ module: 'Auth', name: 'Login', description: '', priority: 'must', assumptions: '', efforts: { [BE]: { o: 40, m: 48, p: 80 } } }
	],
	team: [{ roleId: BE, mp: 1, months: null }],
	overhead: [{ label: 'Server', amount: 1_000_000 }],
	...over
});

describe('membuat estimasi', () => {
	it('versi bertambah, snapshot parameter dan rate, status prospek menjadi Estimasi', () => {
		saveSettings(db, { ...DEFAULT_SETTINGS, focusFactor: 0.7 });
		expect(createEstimate(db, prospectId, today)).toBe(1);
		expect(createEstimate(db, prospectId, today)).toBe(2);
		const e = getEstimate(db, prospectId, 1)!;
		expect(e.draft.settings.focusFactor).toBe(0.7);
		expect(e.rates.map((r) => [r.name, r.monthlyRate])).toEqual([['Backend', 15_000_000], ['QA', null]]);
		expect(getProspect(db, prospectId)!.prospect.status).toBe('estimasi');
		expect(listEstimates(db, prospectId).map((x) => x.version)).toEqual([2, 1]);
	});

	it('tidak bisa untuk prospek Batal', () => {
		changeStatus(db, prospectId, 'batal', { cancelReason: 'x' });
		expect(() => createEstimate(db, prospectId, today)).toThrow(EstimateError);
	});
});

describe('versi revisi', () => {
	it('versi baru menyalin isi dan rate versi terakhir, dapat diedit walau sumbernya final', () => {
		createEstimate(db, prospectId, today);
		const v1 = getEstimate(db, prospectId, 1)!;
		saveEstimate(db, v1.id, draftWith({ assumptions: 'v1' }));
		finalizeEstimate(db, prospectId, 1);
		setRate(db, BE, 20_000_000, '2026-11-01');

		createEstimate(db, prospectId, today);
		const v2 = getEstimate(db, prospectId, 2)!;
		expect(v2.isFinal).toBe(false);
		expect(v2.draft).toEqual(getEstimate(db, prospectId, 1)!.draft);
		expect(v2.rates[0].monthlyRate).toBe(15_000_000);
		saveEstimate(db, v2.id, draftWith({ assumptions: 'v2' }));
		expect(getEstimate(db, prospectId, 1)!.draft.assumptions).toBe('v1');
	});
});

describe('menyimpan', () => {
	it('simpan lalu muat kembali menghasilkan isi yang sama', () => {
		createEstimate(db, prospectId, today);
		const e = getEstimate(db, prospectId, 1)!;
		const draft = draftWith({ assumptions: 'API klien tersedia' });
		saveEstimate(db, e.id, draft);
		expect(getEstimate(db, prospectId, 1)!.draft).toEqual(draft);
		expect(listEstimates(db, prospectId)[0].featureCount).toBe(1);
	});

	it('menolak peran di luar snapshot', () => {
		createEstimate(db, prospectId, today);
		const e = getEstimate(db, prospectId, 1)!;
		expect(() => saveEstimate(db, e.id, draftWith({ team: [{ roleId: 999, mp: 1, months: null }] }))).toThrow(/peran/);
	});

	it('mengubah rate di Pengaturan tidak mengubah estimasi; ambil rate terbaru memperbaruinya', () => {
		createEstimate(db, prospectId, today);
		const e = getEstimate(db, prospectId, 1)!;
		saveEstimate(db, e.id, draftWith());
		setRate(db, BE, 20_000_000, '2026-11-01');
		expect(getEstimate(db, prospectId, 1)!.rates[0].monthlyRate).toBe(15_000_000);

		setRoleActive(db, BE, false); // dipakai di estimasi, tetap dipertahankan
		refreshRates(db, e.id, today);
		expect(getEstimate(db, prospectId, 1)!.rates.map((r) => [r.name, r.monthlyRate])).toEqual([
			['QA', null],
			['Backend', 15_000_000]
		]);
	});
});

describe('finalisasi', () => {
	it('menjelaskan apa yang kurang', () => {
		createEstimate(db, prospectId, today);
		const e = getEstimate(db, prospectId, 1)!;
		saveEstimate(db, e.id, draftWith({
			features: [{ module: '', name: 'Login', description: '', priority: 'must', assumptions: '', efforts: { [QA]: { o: 8, m: 8, p: 8 } } }],
			team: [{ roleId: BE, mp: 1, months: null }]
		}));
		expect(() => finalizeEstimate(db, prospectId, 1)).toThrow(/QA punya effort tetapi belum ada orangnya/);

		saveEstimate(db, e.id, draftWith({
			features: [{ module: '', name: 'Login', description: '', priority: 'must', assumptions: '', efforts: { [QA]: { o: 8, m: 8, p: 8 } } }],
			team: [{ roleId: QA, mp: 1, months: null }]
		}));
		expect(() => finalizeEstimate(db, prospectId, 1)).toThrow(/Rate QA belum diisi/);
	});

	it('final terkunci, hanya satu versi, lalu Deal bisa dipilih', () => {
		createEstimate(db, prospectId, today);
		createEstimate(db, prospectId, today);
		const v1 = getEstimate(db, prospectId, 1)!;
		saveEstimate(db, v1.id, draftWith());
		saveEstimate(db, getEstimate(db, prospectId, 2)!.id, draftWith());
		finalizeEstimate(db, prospectId, 1);
		expect(getEstimate(db, prospectId, 1)!.isFinal).toBe(true);
		expect(() => saveEstimate(db, v1.id, draftWith())).toThrow(/terkunci/);
		expect(() => refreshRates(db, v1.id, today)).toThrow(/terkunci/);
		expect(() => finalizeEstimate(db, prospectId, 2)).toThrow(/Versi 1 sudah ditandai final/);
		dealProspect(db, prospectId, '2027-01-04');
		expect(getProspect(db, prospectId)!.prospect.status).toBe('deal');
	});
});

describe('validasi isi estimasi', () => {
	it('O ≤ M ≤ P wajib; kunci peran dari JSON menjadi angka', () => {
		const json = JSON.parse(JSON.stringify(draftWith()));
		const ok = v.safeParse(EstimateDraftSchema, json);
		expect(ok.success && Object.keys(ok.output.features[0].efforts)).toEqual([String(BE)]);
		json.features[0].efforts[BE] = { o: 50, m: 48, p: 80 };
		expect(v.safeParse(EstimateDraftSchema, json).success).toBe(false);
	});
});

describe('kalender libur', () => {
	it('memuat daftar resmi sekali; estimasi menyalin kalender dan memperbaruinya lewat ambil data terbaru', () => {
		expect(loadOfficialHolidays(db)).toBe(51); // 2026: 25, 2027: 26
		expect(loadOfficialHolidays(db)).toBe(0);
		createEstimate(db, prospectId, today);
		const e = getEstimate(db, prospectId, 1)!;
		expect(e.holidays).toHaveLength(51);

		setHoliday(db, { date: '2027-03-17', name: 'Libur tambahan', type: 'cuti_bersama' });
		expect(getEstimate(db, prospectId, 1)!.holidays).toHaveLength(51);
		refreshRates(db, e.id, today);
		expect(getEstimate(db, prospectId, 1)!.holidays).toHaveLength(52);
	});

	it('mulai saat Lebaran 2027 memperpanjang durasi', () => {
		loadOfficialHolidays(db);
		createEstimate(db, prospectId, today);
		const e = getEstimate(db, prospectId, 1)!;
		const draft = draftWith({
			features: [{ module: '', name: 'Kasir', description: '', priority: 'must', assumptions: '', efforts: { [BE]: { o: 192, m: 192, p: 192 } } }],
			team: [{ roleId: BE, mp: 2, months: null }]
		});
		const tanpa = computeDraft(draft, e.rates, e.holidays).likely.sprint.totalSprints; // 2 + 1
		const lebaran = computeDraft({ ...draft, plannedStart: '2027-03-08' }, e.rates, e.holidays).likely.sprint;
		const biasa = computeDraft({ ...draft, plannedStart: '2027-07-05' }, e.rates, e.holidays).likely.sprint;
		expect(tanpa).toBe(3);
		expect(biasa.totalSprints).toBe(3);
		expect(lebaran.totalSprints).toBe(4);
		saveEstimate(db, e.id, { ...draft, plannedStart: '2027-03-08' });
		expect(getEstimate(db, prospectId, 1)!.draft.plannedStart).toBe('2027-03-08');
	});
});

describe('hapus versi estimasi', () => {
	it('menghapus satu versi beserta isinya; nomor versi lain tetap, versi baru melanjutkan nomor terakhir', () => {
		createEstimate(db, prospectId, today);
		createEstimate(db, prospectId, today);
		createEstimate(db, prospectId, today);
		saveEstimate(db, getEstimate(db, prospectId, 2)!.id, draftWith());
		deleteEstimate(db, prospectId, 2);
		expect(getEstimate(db, prospectId, 2)).toBeNull();
		expect(listEstimates(db, prospectId).map((e) => e.version)).toEqual([3, 1]);
		expect(db.select().from(estimateFeatures).all()).toHaveLength(0); // fitur v2 ikut terhapus
		expect(createEstimate(db, prospectId, today)).toBe(4);
		expect(() => deleteEstimate(db, prospectId, 9)).toThrow(/tidak ditemukan/);
	});

	it('versi final boleh dihapus sebelum Deal; baseline prospek Deal tidak', () => {
		createEstimate(db, prospectId, today);
		createEstimate(db, prospectId, today);
		saveEstimate(db, getEstimate(db, prospectId, 1)!.id, draftWith());
		finalizeEstimate(db, prospectId, 1);
		deleteEstimate(db, prospectId, 1); // belum Deal: boleh
		saveEstimate(db, getEstimate(db, prospectId, 2)!.id, draftWith());
		finalizeEstimate(db, prospectId, 2);
		createEstimate(db, prospectId, today); // v3 draf
		dealProspect(db, prospectId, '2027-01-04');
		expect(() => deleteEstimate(db, prospectId, 2)).toThrow(/baseline proyek/);
		deleteEstimate(db, prospectId, 3); // versi draf lain tetap boleh
		expect(listEstimates(db, prospectId).map((e) => e.version)).toEqual([2]);
	});
});

describe('draf AI (PRD F4)', () => {
	it('penanda draf AI tersimpan; estimasi tidak bisa final sampai ditinjau', () => {
		createEstimate(db, prospectId, today);
		const id = getEstimate(db, prospectId, 1)!.id;
		const withDraft = draftWith();
		withDraft.features = [{ ...withDraft.features[0], aiDraft: true }];
		saveEstimate(db, id, withDraft);
		expect(getEstimate(db, prospectId, 1)!.draft.features[0].aiDraft).toBe(true);
		expect(() => finalizeEstimate(db, prospectId, 1)).toThrow(/1 fitur draf AI belum ditinjau/);
		saveEstimate(db, id, draftWith());
		expect(getEstimate(db, prospectId, 1)!.draft.features[0].aiDraft).toBeUndefined();
		finalizeEstimate(db, prospectId, 1);
	});

	it('saklar AI dan log pemanggilan', () => {
		expect(getAiEnabled(db)).toBe(true);
		setAiEnabled(db, false);
		expect(getAiEnabled(db)).toBe(false);
		setAiEnabled(db, true);
		expect(getAiEnabled(db)).toBe(true);
		logAiCall(db, { provider: 'api.contoh.test', model: 'm', chars: 1234, anonymized: true, ok: true, features: 12 });
		expect(listAiCalls(db)).toEqual([expect.objectContaining({ provider: 'api.contoh.test', chars: 1234, anonymized: true, features: 12 })]);
	});
});
