// Estimasi (PRD F4–F7): versi per prospek, snapshot rate/parameter, simpan, dan finalisasi.
import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
import { computeDraft, finalizeProblems } from '../estimate.ts';
import type { EstimateDraft } from '../validation/estimate.ts';
import type { Db, DbLike } from './db/index.ts';
import {
	estimateEfforts,
	estimateFeatures,
	estimates,
	prospects,
	scenarios,
	scenarioTeam,
	type RateSnapshot
} from './db/schema.ts';
import { getSettings, listHolidays, snapshotRates } from './master.ts';
import { changeStatus } from './prospects.ts';

export class EstimateError extends Error {}

export function listEstimates(db: Db, prospectId: number) {
	return db
		.select({
			id: estimates.id,
			version: estimates.version,
			isFinal: estimates.isFinal,
			createdAt: estimates.createdAt,
			finalizedAt: estimates.finalizedAt,
			featureCount: count(estimateFeatures.id)
		})
		.from(estimates)
		.leftJoin(estimateFeatures, eq(estimateFeatures.estimateId, estimates.id))
		.where(eq(estimates.prospectId, prospectId))
		.groupBy(estimates.id)
		.orderBy(desc(estimates.version))
		.all();
}

/**
 * Versi baru. Versi pertama memakai parameter default dan rate yang berlaku hari ini;
 * versi berikutnya adalah revisi: menyalin isi, parameter, dan rate dari versi terakhir (F7).
 */
export function createEstimate(db: Db, prospectId: number, today: string) {
	const prospect = db.select({ status: prospects.status }).from(prospects).where(eq(prospects.id, prospectId)).get();
	if (!prospect) throw new EstimateError('Prospek tidak ditemukan.');
	if (prospect.status === 'deal' || prospect.status === 'batal')
		throw new EstimateError(`Prospek berstatus ${prospect.status === 'deal' ? 'Deal' : 'Batal'}; estimasi baru tidak dapat dibuat.`);

	const latest = db
		.select()
		.from(estimates)
		.where(eq(estimates.prospectId, prospectId))
		.orderBy(desc(estimates.version))
		.get();
	const copy = latest ? loadDraft(db, latest) : null;
	const version = (latest?.version ?? 0) + 1;

	const id = db.transaction((tx) => {
		const { id } = tx
			.insert(estimates)
			.values({
				prospectId,
				version,
				settings: copy?.settings ?? getSettings(db),
				rates: latest?.rates ?? snapshotRates(db, today),
				holidays: latest?.holidays ?? listHolidays(db)
			})
			.returning({ id: estimates.id })
			.get();
		tx.insert(scenarios).values({ estimateId: id, name: 'Skenario utama' }).run();
		return id;
	});
	if (copy) saveEstimate(db, id, copy);

	if (prospect.status === 'prospek') changeStatus(db, prospectId, 'estimasi', { note: `Estimasi v${version} dibuat` });
	return version;
}

function getRow(db: Db, prospectId: number, version: number) {
	return db
		.select()
		.from(estimates)
		.where(and(eq(estimates.prospectId, prospectId), eq(estimates.version, version)))
		.get();
}

export function mainScenarioId(db: DbLike, estimateId: number) {
	const s = db
		.select({ id: scenarios.id })
		.from(scenarios)
		.where(eq(scenarios.estimateId, estimateId))
		.orderBy(asc(scenarios.sortOrder), asc(scenarios.id))
		.get();
	if (!s) throw new EstimateError('Skenario estimasi tidak ditemukan.');
	return s.id;
}

function loadDraft(db: Db, row: NonNullable<ReturnType<typeof getRow>>): EstimateDraft {
	const features = db
		.select()
		.from(estimateFeatures)
		.where(eq(estimateFeatures.estimateId, row.id))
		.orderBy(asc(estimateFeatures.sortOrder), asc(estimateFeatures.id))
		.all();
	const efforts = features.length
		? db.select().from(estimateEfforts).where(inArray(estimateEfforts.featureId, features.map((f) => f.id))).all()
		: [];
	const scenarioId = mainScenarioId(db, row.id);
	const scenario = db.select().from(scenarios).where(eq(scenarios.id, scenarioId)).get()!;
	const team = db.select().from(scenarioTeam).where(eq(scenarioTeam.scenarioId, scenarioId)).all();

	return {
		settings: row.settings,
		assumptions: row.assumptions,
		exclusions: row.exclusions,
		risks: row.risks,
		plannedStart: row.plannedStart,
		features: features.map((f) => ({
			module: f.module,
			name: f.name,
			description: f.description,
			priority: f.priority,
			assumptions: f.assumptions,
			efforts: Object.fromEntries(
				efforts.filter((e) => e.featureId === f.id).map((e) => [e.roleId, { o: e.o, m: e.m, p: e.p }])
			)
		})),
		team: team.map((t) => ({ roleId: t.roleId, mp: t.mp, months: t.months })),
		overhead: scenario.overhead
	};
}

export function getEstimate(db: Db, prospectId: number, version: number) {
	const row = getRow(db, prospectId, version);
	if (!row) return null;
	return {
		id: row.id,
		prospectId: row.prospectId,
		version: row.version,
		isFinal: row.isFinal,
		finalizedAt: row.finalizedAt,
		createdAt: row.createdAt,
		rates: row.rates,
		holidays: row.holidays,
		draft: loadDraft(db, row)
	};
}

/** Estimasi berdasarkan ID beserta prospeknya (untuk halaman cetak). */
export function getEstimateById(db: Db, id: number) {
	const row = db.select({ prospectId: estimates.prospectId, version: estimates.version }).from(estimates).where(eq(estimates.id, id)).get();
	return row ? getEstimate(db, row.prospectId, row.version) : null;
}

function assertEditable(db: Db, estimateId: number) {
	const row = db.select({ isFinal: estimates.isFinal }).from(estimates).where(eq(estimates.id, estimateId)).get();
	if (!row) throw new EstimateError('Estimasi tidak ditemukan.');
	if (row.isFinal) throw new EstimateError('Estimasi final terkunci. Buat versi baru untuk merevisi.');
}

/** Menyimpan seluruh isi estimasi (draf) dalam satu transaksi. */
export function saveEstimate(db: Db, estimateId: number, draft: EstimateDraft) {
	assertEditable(db, estimateId);
	const row = db.select({ rates: estimates.rates }).from(estimates).where(eq(estimates.id, estimateId)).get()!;
	const known = new Set(row.rates.map((r) => r.roleId));
	const used = [...draft.features.flatMap((f) => Object.keys(f.efforts).map(Number)), ...draft.team.map((t) => t.roleId)];
	if (used.some((id) => !known.has(id))) throw new EstimateError('Ada peran yang tidak ada di estimasi ini.');

	const scenarioId = mainScenarioId(db, estimateId);
	db.transaction((tx) => {
		tx.update(estimates)
			.set({
				settings: draft.settings,
				assumptions: draft.assumptions,
				exclusions: draft.exclusions,
				risks: draft.risks,
				plannedStart: draft.plannedStart
			})
			.where(eq(estimates.id, estimateId))
			.run();
		tx.delete(estimateFeatures).where(eq(estimateFeatures.estimateId, estimateId)).run();
		draft.features.forEach((f, i) => {
			const { id } = tx
				.insert(estimateFeatures)
				.values({ estimateId, module: f.module, name: f.name, description: f.description, priority: f.priority, assumptions: f.assumptions, sortOrder: i })
				.returning({ id: estimateFeatures.id })
				.get();
			const rows = Object.entries(f.efforts)
				.filter(([, t]) => t.o > 0 || t.m > 0 || t.p > 0)
				.map(([roleId, t]) => ({ featureId: id, roleId: Number(roleId), ...t }));
			if (rows.length) tx.insert(estimateEfforts).values(rows).run();
		});
		tx.update(scenarios).set({ overhead: draft.overhead }).where(eq(scenarios.id, scenarioId)).run();
		tx.delete(scenarioTeam).where(eq(scenarioTeam.scenarioId, scenarioId)).run();
		const team = draft.team.filter((t) => t.mp > 0 || t.months !== null);
		if (team.length) tx.insert(scenarioTeam).values(team.map((t) => ({ scenarioId, ...t }))).run();
	});
}

/**
 * Mengambil ulang rate dan kalender libur dari Pengaturan untuk estimasi draf.
 * Peran yang sudah dipakai tetapi kini nonaktif tetap dipertahankan dengan rate lamanya.
 */
export function refreshRates(db: Db, estimateId: number, today: string) {
	assertEditable(db, estimateId);
	const row = db.select().from(estimates).where(eq(estimates.id, estimateId)).get()!;
	const fresh = snapshotRates(db, today);
	const freshIds = new Set(fresh.map((r) => r.roleId));
	const draft = loadDraft(db, row);
	const used = new Set([...draft.features.flatMap((f) => Object.keys(f.efforts).map(Number)), ...draft.team.map((t) => t.roleId)]);
	const kept: RateSnapshot[] = row.rates.filter((r) => used.has(r.roleId) && !freshIds.has(r.roleId));
	db.update(estimates).set({ rates: [...fresh, ...kept], holidays: listHolidays(db) }).where(eq(estimates.id, estimateId)).run();
}

/** Menandai versi final (F7): hanya satu per prospek, lalu terkunci. */
export function finalizeEstimate(db: Db, prospectId: number, version: number) {
	const row = getRow(db, prospectId, version);
	if (!row) throw new EstimateError('Estimasi tidak ditemukan.');
	if (row.isFinal) throw new EstimateError('Versi ini sudah final.');
	const other = db
		.select({ version: estimates.version })
		.from(estimates)
		.where(and(eq(estimates.prospectId, prospectId), eq(estimates.isFinal, true)))
		.get();
	if (other) throw new EstimateError(`Versi ${other.version} sudah ditandai final. Hanya satu versi yang boleh final.`);
	const draft = loadDraft(db, row);
	const problems = finalizeProblems(draft, row.rates, computeDraft(draft, row.rates, row.holidays));
	if (problems.length) throw new EstimateError(problems.join(' '));
	db.update(estimates).set({ isFinal: true, finalizedAt: new Date() }).where(eq(estimates.id, row.id)).run();
}

/**
 * Menghapus satu versi estimasi beserta fitur, tim, dan skenarionya (cascade).
 * Nomor versi lain tidak diubah, agar ringkasan yang sudah dikirim tetap merujuk versi yang sama.
 * Versi final dari prospek Deal adalah baseline proyek (F9) sehingga tidak bisa dihapus.
 */
export function deleteEstimate(db: Db, prospectId: number, version: number) {
	const row = getRow(db, prospectId, version);
	if (!row) throw new EstimateError('Estimasi tidak ditemukan.');
	const prospect = db.select({ status: prospects.status }).from(prospects).where(eq(prospects.id, prospectId)).get();
	if (row.isFinal && prospect?.status === 'deal')
		throw new EstimateError('Versi final dari prospek yang sudah Deal adalah baseline proyek dan tidak dapat dihapus.');
	db.delete(estimates).where(eq(estimates.id, row.id)).run();
}
