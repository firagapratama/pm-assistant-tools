// Library fitur (PRD F3): template dengan effort default per peran (jam). Dipakai dengan cara disalin.
import { asc, eq, inArray } from 'drizzle-orm';
import { isOrdered, pertE } from '../calc/pert.ts';
import type { ThreePointMap } from '../change-request.ts';
import type { Db } from './db/index.ts';
import { featureTemplateEfforts, featureTemplates, roles } from './db/schema.ts';

export class LibraryError extends Error {}

export const COMPLEXITIES = ['rendah', 'sedang', 'tinggi'] as const;
export type Complexity = (typeof COMPLEXITIES)[number];

export interface TemplateInput {
	name: string;
	category: string;
	complexity: Complexity;
	description: string;
	assumptions: string;
	efforts: ThreePointMap;
}

export function listTemplates(db: Db) {
	const rows = db.select().from(featureTemplates).orderBy(asc(featureTemplates.category), asc(featureTemplates.name)).all();
	const efforts = rows.length
		? db.select().from(featureTemplateEfforts).where(inArray(featureTemplateEfforts.templateId, rows.map((r) => r.id))).all()
		: [];
	return rows.map((r) => ({
		...r,
		efforts: Object.fromEntries(efforts.filter((e) => e.templateId === r.id).map((e) => [e.roleId, { o: e.o, m: e.m, p: e.p }])) as ThreePointMap
	}));
}

export type FeatureTemplate = ReturnType<typeof listTemplates>[number];

function text(value: string, max: number, label: string) {
	const v = value.trim();
	if (v.length > max) throw new LibraryError(`${label} maksimal ${max} karakter.`);
	return v;
}

function clean(db: Db, input: TemplateInput) {
	const name = text(input.name, 160, 'Nama fitur');
	if (!name) throw new LibraryError('Nama fitur belum diisi.');
	const category = text(input.category, 80, 'Kategori') || 'Lainnya';
	if (!COMPLEXITIES.includes(input.complexity)) throw new LibraryError('Kompleksitas tidak dikenal.');
	const known = new Set(db.select({ id: roles.id }).from(roles).all().map((r) => r.id));
	const efforts: ThreePointMap = {};
	for (const [k, t] of Object.entries(input.efforts)) {
		if (!known.has(Number(k))) throw new LibraryError('Ada peran yang tidak dikenal.');
		if (![t.o, t.m, t.p].every((n) => Number.isFinite(n) && n >= 0 && n <= 100_000)) throw new LibraryError('Effort harus angka 0–100.000 jam.');
		if (!isOrdered(t)) throw new LibraryError('Nilai optimis ≤ paling mungkin ≤ pesimis.');
		if (pertE(t) > 0) efforts[Number(k)] = { o: t.o, m: t.m, p: t.p };
	}
	return {
		row: { name, category, complexity: input.complexity, description: text(input.description, 2000, 'Deskripsi'), assumptions: text(input.assumptions, 2000, 'Asumsi') },
		efforts
	};
}

/** Tambah (id = null) atau ubah template; effort diganti seluruhnya. */
export function saveTemplate(db: Db, id: number | null, input: TemplateInput): number {
	const { row, efforts } = clean(db, input);
	return db.transaction((tx) => {
		let templateId = id;
		if (templateId === null) templateId = tx.insert(featureTemplates).values(row).returning({ id: featureTemplates.id }).get().id;
		else if (!tx.update(featureTemplates).set(row).where(eq(featureTemplates.id, templateId)).run().changes) throw new LibraryError('Template tidak ditemukan.');
		tx.delete(featureTemplateEfforts).where(eq(featureTemplateEfforts.templateId, templateId)).run();
		const values = Object.entries(efforts).map(([roleId, t]) => ({ templateId: templateId!, roleId: Number(roleId), ...t }));
		if (values.length) tx.insert(featureTemplateEfforts).values(values).run();
		return templateId;
	});
}

export function deleteTemplate(db: Db, id: number) {
	if (!db.delete(featureTemplates).where(eq(featureTemplates.id, id)).run().changes) throw new LibraryError('Template tidak ditemukan.');
}
