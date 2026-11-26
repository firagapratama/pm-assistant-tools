import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as v from 'valibot';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../calc/settings.ts';
import { ProspectSchema } from '../validation/prospect.ts';
import { openDb, type Db } from './db/index.ts';
import { estimateEfforts, estimateFeatures, estimates, roles, scenarios, statusHistory } from './db/schema.ts';
import {
	StatusChangeError,
	changeStatus,
	createProspect,
	deleteProspect,
	deletionImpact,
	getProspect,
	listClients,
	listProspects,
	updateProspect
} from './prospects.ts';
import { dealProspect } from './projects.ts';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
	migrate(db, { migrationsFolder: 'drizzle' });
});

/** Versi estimasi final minimal (dengan skenario utama) agar prospek bisa Deal. */
const finalEstimate = (prospectId: number) => {
	const e = db.insert(estimates).values({ prospectId, version: 1, isFinal: true, settings: DEFAULT_SETTINGS, rates: [] }).returning().get();
	db.insert(scenarios).values({ estimateId: e.id, name: 'Utama' }).run();
};

const input = (over: Partial<Record<string, string>> = {}) =>
	v.parse(ProspectSchema, { name: 'Aplikasi Kasir', client: 'Toko Maju', budget: '400.000.000', ...over });

describe('prospek', () => {
	it('dibuat dengan status Prospek dan tercatat di riwayat', () => {
		const id = createProspect(db, input());
		const p = getProspect(db, id)!;
		expect(p.prospect).toMatchObject({ status: 'prospek', budget: 400_000_000, deadline: null });
		expect(p.history).toMatchObject([{ from: null, to: 'prospek' }]);
	});

	it('pencarian nama (tanpa beda huruf besar), filter status dan klien', () => {
		const a = createProspect(db, input());
		createProspect(db, input({ name: 'Portal Vendor', client: 'PT Sinar' }));
		createProspect(db, input({ name: '100% Diskon_', client: '' }));
		changeStatus(db, a, 'estimasi');

		const names = (f: Parameters<typeof listProspects>[1]) => listProspects(db, f).map((p) => p.name);
		expect(names({ q: 'kasir' })).toEqual(['Aplikasi Kasir']);
		expect(names({ q: '%' })).toEqual(['100% Diskon_']); // tanda % tidak dianggap wildcard
		expect(names({ status: 'estimasi' })).toEqual(['Aplikasi Kasir']);
		expect(names({ client: 'PT Sinar' })).toEqual(['Portal Vendor']);
		expect(listClients(db)).toEqual(['PT Sinar', 'Toko Maju']);
	});

	it('mengubah data tidak mengubah status', () => {
		const id = createProspect(db, input());
		changeStatus(db, id, 'estimasi');
		updateProspect(db, id, input({ name: 'Kasir v2' }));
		expect(getProspect(db, id)!.prospect).toMatchObject({ name: 'Kasir v2', status: 'estimasi' });
	});
});

describe('perubahan status', () => {
	it('tercatat di riwayat dengan status lama dan baru', () => {
		const id = createProspect(db, input());
		changeStatus(db, id, 'estimasi', { note: 'Mulai breakdown' });
		changeStatus(db, id, 'proposal');
		expect(getProspect(db, id)!.history.map((h) => [h.from, h.to, h.note])).toEqual([
			['estimasi', 'proposal', ''],
			['prospek', 'estimasi', 'Mulai breakdown'],
			[null, 'prospek', '']
		]);
		expect(listProspects(db)[0].statusSince).toBeInstanceOf(Date);
	});

	it('Batal wajib beralasan; dibuka kembali menghapus alasan', () => {
		const id = createProspect(db, input());
		expect(() => changeStatus(db, id, 'batal', { cancelReason: '  ' })).toThrow(StatusChangeError);
		changeStatus(db, id, 'batal', { cancelReason: 'Anggaran klien dipotong' });
		expect(getProspect(db, id)!.prospect).toMatchObject({ status: 'batal', cancelReason: 'Anggaran klien dipotong' });
		expect(getProspect(db, id)!.history[0].note).toBe('Anggaran klien dipotong');
		changeStatus(db, id, 'prospek');
		expect(getProspect(db, id)!.prospect.cancelReason).toBeNull();
	});

	it('Deal hanya jika ada estimasi final, lalu terkunci', () => {
		const id = createProspect(db, input());
		expect(() => dealProspect(db, id, '2027-01-04')).toThrow(/final/);
		finalEstimate(id);
		dealProspect(db, id, '2027-01-04');
		expect(() => changeStatus(db, id, 'negosiasi')).toThrow(/change request/);
	});

	it('status yang sama ditolak', () => {
		const id = createProspect(db, input());
		expect(() => changeStatus(db, id, 'prospek')).toThrow(/tidak berubah/);
	});
});

describe('hapus prospek', () => {
	it('menghapus prospek beserta riwayat dan semua versi estimasi', () => {
		const keep = createProspect(db, input({ name: 'Tetap ada' }));
		const id = createProspect(db, input());
		changeStatus(db, id, 'estimasi');
		const e = db.insert(estimates).values({ prospectId: id, version: 1, settings: DEFAULT_SETTINGS, rates: [] }).returning().get();
		db.insert(scenarios).values({ estimateId: e.id, name: 'Utama' }).run();
		const f = db.insert(estimateFeatures).values({ estimateId: e.id, name: 'Login' }).returning().get();
		const role = db.insert(roles).values({ name: 'Backend' }).returning().get();
		db.insert(estimateEfforts).values({ featureId: f.id, roleId: role.id, o: 1, m: 2, p: 3 }).run();
		expect(deletionImpact(db, id)).toEqual({ estimates: 1, finalEstimates: 0 });

		deleteProspect(db, id);
		expect(getProspect(db, id)).toBeNull();
		expect(db.select().from(statusHistory).all().every((h) => h.prospectId === keep)).toBe(true);
		expect(db.select().from(estimates).all()).toHaveLength(0);
		expect(db.select().from(estimateFeatures).all()).toHaveLength(0);
		expect(db.select().from(estimateEfforts).all()).toHaveLength(0);
		expect(db.select().from(scenarios).all()).toHaveLength(0);
		expect(getProspect(db, keep)).not.toBeNull();
		expect(db.select().from(roles).all()).toHaveLength(1); // master data tidak ikut terhapus
	});

	it('prospek Deal tidak bisa dihapus', () => {
		const id = createProspect(db, input());
		finalEstimate(id);
		dealProspect(db, id, '2027-01-04');
		expect(deletionImpact(db, id)).toEqual({ estimates: 1, finalEstimates: 1 });
		expect(() => deleteProspect(db, id)).toThrow(/Deal tidak dapat dihapus/);
		expect(getProspect(db, id)).not.toBeNull();
	});
});
