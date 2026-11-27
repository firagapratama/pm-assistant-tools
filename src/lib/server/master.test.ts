import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as v from 'valibot';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../calc/settings.ts';
import { NewRoleSchema, SettingsSchema, fieldErrors } from '../validation/master.ts';
import { openDb, type Db } from './db/index.ts';
import {
	DuplicateRoleError,
	createRole,
	deleteRate,
	getSettings,
	listRoles,
	saveSettings,
	setRate,
	setRoleActive,
	snapshotRates,
	updateRole
} from './master.ts';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
	migrate(db, { migrationsFolder: 'drizzle' });
});

const backend = { name: 'Backend', level: 'senior', source: 'internal' } as const;

describe('peran dan rate', () => {
	it('rate yang berlaku dipilih berdasarkan tanggal', () => {
		const id = createRole(db, backend, { monthlyRate: 15_000_000, effectiveFrom: '2026-01-01' });
		setRate(db, id, 16_000_000, '2026-07-01');
		setRate(db, id, 17_000_000, '2027-01-01');

		const [r] = listRoles(db, '2026-11-26');
		expect(r.currentRate?.monthlyRate).toBe(16_000_000);
		expect(r.upcomingRate?.monthlyRate).toBe(17_000_000);
		expect(r.rates.map((x) => x.effectiveFrom)).toEqual(['2027-01-01', '2026-07-01', '2026-01-01']);
		expect(listRoles(db, '2025-12-31')[0].currentRate).toBeNull();
	});

	it('rate di tanggal yang sama menimpa, dan bisa dihapus', () => {
		const id = createRole(db, backend);
		setRate(db, id, 15_000_000, '2026-01-01');
		setRate(db, id, 15_500_000, '2026-01-01');
		const [r] = listRoles(db, '2026-11-26');
		expect(r.rates).toHaveLength(1);
		expect(r.currentRate?.monthlyRate).toBe(15_500_000);
		deleteRate(db, r.rates[0].id);
		expect(listRoles(db, '2026-11-26')[0].rates).toHaveLength(0);
	});

	it('menolak peran ganda, tetapi level atau sumber berbeda boleh', () => {
		const id = createRole(db, backend);
		expect(() => createRole(db, backend)).toThrow(DuplicateRoleError);
		createRole(db, { ...backend, level: 'mid' });
		const vendor = createRole(db, { ...backend, source: 'vendor' });
		expect(() => updateRole(db, vendor, backend)).toThrow(DuplicateRoleError);
		updateRole(db, id, { ...backend, name: 'Backend' }); // menyimpan diri sendiri tidak dianggap ganda
	});

	it('peran nonaktif tidak masuk snapshot dan diurutkan ke bawah', () => {
		const a = createRole(db, { name: 'QA', level: null, source: 'internal' }, { monthlyRate: 10_000_000, effectiveFrom: '2026-01-01' });
		const b = createRole(db, backend);
		setRoleActive(db, a, false);
		expect(listRoles(db, '2026-11-26').map((r) => r.id)).toEqual([b, a]);
		expect(snapshotRates(db, '2026-11-26')).toEqual([
			{ roleId: b, name: 'Backend', level: 'senior', source: 'internal', monthlyRate: null }
		]);
	});

	it('snapshot tidak berubah saat rate diubah kemudian', () => {
		const id = createRole(db, backend, { monthlyRate: 15_000_000, effectiveFrom: '2026-01-01' });
		const snap = snapshotRates(db, '2026-11-26');
		setRate(db, id, 20_000_000, '2026-01-01');
		expect(snap[0].monthlyRate).toBe(15_000_000);
	});
});

describe('parameter default', () => {
	it('default dipakai sebelum disimpan, lalu tersimpan', () => {
		expect(getSettings(db)).toEqual(DEFAULT_SETTINGS);
		saveSettings(db, { ...DEFAULT_SETTINGS, focusFactor: 0.7 });
		saveSettings(db, { ...DEFAULT_SETTINGS, focusFactor: 0.75 });
		expect(getSettings(db).focusFactor).toBe(0.75);
	});
});

describe('validasi form', () => {
	const form = {
		inputUnit: 'sp', spPerHour: '2', sprintWeeks: '2', workDaysPerSprint: '10', effectiveHoursPerDay: '6',
		focusFactor: '0,8', stabilizationSprints: '1', contingencyBp: '15', markupBp: '12,5', weeksPerMonth: '4', rangeSigma: '1',
		leaveDaysPerYear: '12', sickDaysPerYear: '3', overtimeHoursPerSprint: '0'
	};

	it('parameter dari form menjadi angka dan basis poin', () => {
		const r = v.safeParse(SettingsSchema, form);
		expect(r.success && r.output).toEqual({ ...DEFAULT_SETTINGS, markupBp: 1250 });
	});

	it('pesan error per field', () => {
		const r = v.safeParse(SettingsSchema, { ...form, focusFactor: '1,5', sprintWeeks: 'dua' });
		expect(r.success).toBe(false);
		if (!r.success) {
			const e = fieldErrors(r.issues);
			expect(e.focusFactor).toMatch(/Focus factor/);
			expect(e.sprintWeeks).toMatch(/angka/);
		}
	});

	it('peran baru: rate kosong boleh, level kosong = null', () => {
		const r = v.safeParse(NewRoleSchema, { name: ' QA ', level: '', source: 'internal', monthlyRate: '', effectiveFrom: '2026-11-26' });
		expect(r.success && r.output).toEqual({ name: 'QA', level: null, source: 'internal', monthlyRate: null, effectiveFrom: '2026-11-26' });
		const bad = v.safeParse(NewRoleSchema, { name: '', level: 'x', source: 'internal', monthlyRate: '1,5', effectiveFrom: '' });
		expect(bad.success).toBe(false);
	});
});
