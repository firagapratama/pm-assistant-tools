// Master data (PRD F1): peran, rate card bertanggal berlaku, dan parameter default.
import { and, asc, desc, eq, ne } from 'drizzle-orm';
import type { Holiday } from '../calc/calendar.ts';
import { DEFAULT_SETTINGS, type EstimateSettings } from '../calc/settings.ts';
import type { Level, Source } from '../labels.ts';
import type { Db } from './db/index.ts';
import { aiCalls, holidays, rateCards, roles, settings, type RateSnapshot } from './db/schema.ts';
import { OFFICIAL_HOLIDAYS } from './holidays-id.ts';

export interface RateEntry {
	id: number;
	monthlyRate: number;
	effectiveFrom: string;
}

export interface RoleWithRates {
	id: number;
	name: string;
	level: Level | null;
	source: Source;
	active: boolean;
	/** Terbaru dulu. */
	rates: RateEntry[];
	/** Rate dengan tanggal berlaku terakhir yang ≤ hari ini. */
	currentRate: RateEntry | null;
	/** Rate terdekat yang mulai berlaku setelah hari ini. */
	upcomingRate: RateEntry | null;
}

export interface RoleInput {
	name: string;
	level: Level | null;
	source: Source;
}

export class DuplicateRoleError extends Error {}

export function listRoles(db: Db, today: string): RoleWithRates[] {
	const allRates = db.select().from(rateCards).orderBy(asc(rateCards.effectiveFrom)).all();
	return db
		.select()
		.from(roles)
		.orderBy(asc(roles.id))
		.all()
		.map((r) => {
			const rates = allRates
				.filter((x) => x.roleId === r.id)
				.map(({ id, monthlyRate, effectiveFrom }) => ({ id, monthlyRate, effectiveFrom }));
			return {
				id: r.id,
				name: r.name,
				level: r.level,
				source: r.source,
				active: r.active,
				rates: rates.toReversed(),
				currentRate: rates.findLast((x) => x.effectiveFrom <= today) ?? null,
				upcomingRate: rates.find((x) => x.effectiveFrom > today) ?? null
			};
		})
		.sort((a, b) => Number(b.active) - Number(a.active));
}

function assertUnique(db: Db, input: RoleInput, exceptId?: number) {
	const same = db
		.select({ id: roles.id, level: roles.level, source: roles.source })
		.from(roles)
		.where(and(eq(roles.name, input.name), exceptId ? ne(roles.id, exceptId) : undefined))
		.all()
		.some((r) => r.level === input.level && r.source === input.source);
	if (same) throw new DuplicateRoleError('Peran dengan nama, level, dan sumber yang sama sudah ada.');
}

export function createRole(
	db: Db,
	input: RoleInput,
	rate?: { monthlyRate: number; effectiveFrom: string }
): number {
	assertUnique(db, input);
	return db.transaction((tx) => {
		const { id } = tx.insert(roles).values(input).returning({ id: roles.id }).get();
		if (rate) tx.insert(rateCards).values({ roleId: id, ...rate }).run();
		return id;
	});
}

export function updateRole(db: Db, id: number, input: RoleInput) {
	assertUnique(db, input, id);
	db.update(roles).set(input).where(eq(roles.id, id)).run();
}

/** Peran tidak pernah dihapus agar estimasi lama tetap bisa menampilkannya. */
export function setRoleActive(db: Db, id: number, active: boolean) {
	db.update(roles).set({ active }).where(eq(roles.id, id)).run();
}

/** Satu rate per peran per tanggal; tanggal yang sama menimpa rate sebelumnya. */
export function setRate(db: Db, roleId: number, monthlyRate: number, effectiveFrom: string) {
	db.insert(rateCards)
		.values({ roleId, monthlyRate, effectiveFrom })
		.onConflictDoUpdate({ target: [rateCards.roleId, rateCards.effectiveFrom], set: { monthlyRate } })
		.run();
}

export function deleteRate(db: Db, rateId: number) {
	db.delete(rateCards).where(eq(rateCards.id, rateId)).run();
}

export function getSettings(db: Db): EstimateSettings {
	const row = db.select().from(settings).where(eq(settings.id, 1)).get();
	// Gabung dengan default agar parameter yang ditambahkan kemudian tetap terisi.
	return { ...DEFAULT_SETTINGS, ...row?.values };
}

export function saveSettings(db: Db, values: EstimateSettings) {
	db.insert(settings)
		.values({ id: 1, values })
		.onConflictDoUpdate({ target: settings.id, set: { values } })
		.run();
}

/** Salinan peran aktif dan rate yang berlaku pada `date`, untuk disimpan di estimasi baru. */
// ── Draf AI (PRD F4) ──

export function getAiEnabled(db: Db): boolean {
	return db.select({ on: settings.aiEnabled }).from(settings).where(eq(settings.id, 1)).get()?.on ?? true;
}

export function setAiEnabled(db: Db, on: boolean) {
	db.insert(settings)
		.values({ id: 1, values: getSettings(db), aiEnabled: on })
		.onConflictDoUpdate({ target: settings.id, set: { aiEnabled: on } })
		.run();
}

export function logAiCall(db: Db, call: typeof aiCalls.$inferInsert) {
	db.insert(aiCalls).values(call).run();
}

export function listAiCalls(db: Db, limit = 20) {
	return db.select().from(aiCalls).orderBy(desc(aiCalls.id)).limit(limit).all();
}

export function snapshotRates(db: Db, date: string): RateSnapshot[] {
	return listRoles(db, date)
		.filter((r) => r.active)
		.map((r) => ({
			roleId: r.id,
			name: r.name,
			level: r.level,
			source: r.source,
			monthlyRate: r.currentRate?.monthlyRate ?? null
		}));
}

// ── Kalender libur ─────────────────────────────────────────────

export function listHolidays(db: Db): Holiday[] {
	return db
		.select({ date: holidays.date, name: holidays.name, type: holidays.type })
		.from(holidays)
		.orderBy(asc(holidays.date))
		.all();
}

/** Satu entri per tanggal; tanggal yang sama menimpa nama dan jenisnya. */
export function setHoliday(db: Db, h: Holiday) {
	db.insert(holidays)
		.values(h)
		.onConflictDoUpdate({ target: holidays.date, set: { name: h.name, type: h.type } })
		.run();
}

export function deleteHoliday(db: Db, date: string) {
	db.delete(holidays).where(eq(holidays.date, date)).run();
}

/** Memuat daftar resmi SKB tanpa menimpa tanggal yang sudah ada. Mengembalikan jumlah yang ditambahkan. */
export function loadOfficialHolidays(db: Db, years = Object.keys(OFFICIAL_HOLIDAYS).map(Number)): number {
	const rows = years.flatMap((y) => OFFICIAL_HOLIDAYS[y] ?? []);
	if (!rows.length) return 0;
	return db.insert(holidays).values(rows).onConflictDoNothing().run().changes;
}
