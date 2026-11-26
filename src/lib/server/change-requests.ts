// Change request (PRD F13): diajukan → disetujui/ditolak. Keputusan final; dampak dibekukan saat diputuskan.
import { and, asc, eq, max } from 'drizzle-orm';
import { isOrdered, pertE } from '../calc/pert.ts';
import { crImpact, type CrContext, type ThreePointMap } from '../change-request.ts';
import { maxPlanSprint } from '../project.ts';
import type { Db } from './db/index.ts';
import { changeRequests, projectFeatures, projects } from './db/schema.ts';
import { getEstimateById } from './estimates.ts';
import { syncSprintActivities } from './projects.ts';

export class CrError extends Error {}

export interface CrInput {
	title: string;
	description: string;
	requester: string;
	requestDate: string;
	reason: string;
	efforts: ThreePointMap;
}

export interface CrDecision {
	status: 'disetujui' | 'ditolak';
	approver: string;
	decisionDate: string;
	note: string;
}

const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

function limit(value: string, max: number, label: string) {
	const v = value.trim();
	if (v.length > max) throw new CrError(`${label} maksimal ${max} karakter.`);
	return v;
}

/** Proyek, konteks perhitungan (estimasi baseline), dan effort CR yang sudah disetujui. */
export function crContext(db: Db, projectId: number) {
	const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
	if (!project) throw new CrError('Proyek tidak ditemukan.');
	const estimate = getEstimateById(db, project.baselineEstimateId)!;
	const ctx: CrContext = { draft: estimate.draft, rates: estimate.rates, holidays: estimate.holidays, startDate: project.startDate };
	const approved = db
		.select()
		.from(changeRequests)
		.where(and(eq(changeRequests.projectId, projectId), eq(changeRequests.status, 'disetujui')))
		.orderBy(asc(changeRequests.number))
		.all();
	return { project, ctx, approved };
}

function clean(input: CrInput, teamRoles: Set<number>): CrInput {
	const title = limit(input.title, 160, 'Judul');
	if (!title) throw new CrError('Judul perubahan belum diisi.');
	if (!isDate(input.requestDate)) throw new CrError('Tanggal pengajuan tidak valid.');
	const efforts: ThreePointMap = {};
	for (const [k, t] of Object.entries(input.efforts)) {
		const roleId = Number(k);
		if (!teamRoles.has(roleId)) throw new CrError('Effort hanya untuk peran yang ada di tim proyek.');
		if (![t.o, t.m, t.p].every((n) => Number.isFinite(n) && n >= 0 && n <= 100_000)) throw new CrError('Effort harus angka 0–100.000 jam.');
		if (!isOrdered(t)) throw new CrError('Nilai optimis ≤ paling mungkin ≤ pesimis.');
		if (pertE(t) > 0) efforts[roleId] = { o: t.o, m: t.m, p: t.p };
	}
	if (!Object.keys(efforts).length) throw new CrError('Isi effort minimal untuk satu peran.');
	return {
		title,
		description: limit(input.description, 2000, 'Deskripsi'),
		requester: limit(input.requester, 120, 'Peminta'),
		requestDate: input.requestDate,
		reason: limit(input.reason, 2000, 'Alasan'),
		efforts
	};
}

function pending(db: Db, projectId: number, id: number) {
	const cr = db.select().from(changeRequests).where(and(eq(changeRequests.id, id), eq(changeRequests.projectId, projectId))).get();
	if (!cr) throw new CrError('Change request tidak ada di proyek ini.');
	if (cr.status !== 'diajukan') throw new CrError('Change request sudah diputuskan dan tidak bisa diubah.');
	return cr;
}

/** Tambah (id = null) atau ubah CR yang masih diajukan. */
export function saveChangeRequest(db: Db, projectId: number, id: number | null, input: CrInput): number {
	const { project } = crContext(db, projectId);
	const data = clean(input, new Set(project.baseline.team.map((t) => t.roleId)));
	if (id !== null) {
		pending(db, projectId, id);
		db.update(changeRequests).set(data).where(eq(changeRequests.id, id)).run();
		return id;
	}
	const last = db.select({ n: max(changeRequests.number) }).from(changeRequests).where(eq(changeRequests.projectId, projectId)).get()?.n ?? 0;
	return db
		.insert(changeRequests)
		.values({ ...data, projectId, number: last + 1 })
		.returning({ id: changeRequests.id })
		.get().id;
}

/** Hanya CR yang belum diputuskan boleh dihapus; keputusan tetap tercatat. */
export function deleteChangeRequest(db: Db, projectId: number, id: number) {
	pending(db, projectId, id);
	db.delete(changeRequests).where(eq(changeRequests.id, id)).run();
}

/**
 * Menyetujui/menolak CR. Dampak dihitung terhadap baseline + CR yang sudah disetujui lalu dibekukan.
 * CR yang disetujui masuk jadwal setelah fitur terakhir; PM dapat menggesernya di tabel jadwal.
 */
export function decideChangeRequest(db: Db, projectId: number, id: number, decision: CrDecision) {
	const cr = pending(db, projectId, id);
	if (decision.status !== 'disetujui' && decision.status !== 'ditolak') throw new CrError('Keputusan tidak dikenal.');
	const approver = limit(decision.approver, 120, 'Penyetuju');
	if (!approver) throw new CrError('Isi nama penyetuju.');
	if (!isDate(decision.decisionDate)) throw new CrError('Tanggal keputusan tidak valid.');
	if (decision.decisionDate < cr.requestDate) throw new CrError('Tanggal keputusan tidak boleh sebelum tanggal pengajuan.');

	const { project, ctx, approved } = crContext(db, projectId);
	const impact = crImpact(
		ctx,
		approved.map((c) => c.efforts),
		cr.efforts
	);
	db.transaction((tx) => {
		tx.update(changeRequests)
			.set({ status: decision.status, approver, decisionDate: decision.decisionDate, decisionNote: limit(decision.note, 2000, 'Catatan'), impact })
			.where(eq(changeRequests.id, id))
			.run();
		if (decision.status !== 'disetujui') return;
		const lastEnd =
			tx.select({ n: max(projectFeatures.planEnd) }).from(projectFeatures).where(eq(projectFeatures.projectId, projectId)).get()?.n ??
			project.baseline.devSprints;
		const cap = maxPlanSprint(project.baseline.totalSprints);
		const start = Math.min(cap, impact.sprints > 0 ? lastEnd + 1 : Math.max(1, lastEnd));
		const end = Math.min(cap, start + Math.max(1, impact.sprints) - 1);
		tx.insert(projectFeatures)
			.values({ projectId, changeRequestId: id, baselineStart: start, baselineEnd: end, planStart: start, planEnd: end })
			.run();
		syncSprintActivities(tx, projectId);
	});
	return impact;
}
