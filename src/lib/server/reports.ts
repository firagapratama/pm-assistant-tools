// Laporan status mingguan (PRD F14).
import { and, desc, eq } from 'drizzle-orm';
import { statusInputFrom } from '../project-status.ts';
import { buildReport, weekOf } from '../report.ts';
import type { Db } from './db/index.ts';
import { statusReports } from './db/schema.ts';
import { getProject } from './projects.ts';

export class ReportError extends Error {}

export function listReports(db: Db, projectId: number) {
	return db.select().from(statusReports).where(eq(statusReports.projectId, projectId)).orderBy(desc(statusReports.periodStart)).all();
}

export type ReportRow = ReturnType<typeof listReports>[number];

/** Laporan minggu ini (dibuat bila belum ada). */
export function createWeeklyReport(db: Db, projectId: number, today: string): number {
	const { start, end } = weekOf(today);
	const existing = db
		.select({ id: statusReports.id })
		.from(statusReports)
		.where(and(eq(statusReports.projectId, projectId), eq(statusReports.periodStart, start)))
		.get();
	if (existing) return existing.id;
	return db.insert(statusReports).values({ projectId, periodStart: start, periodEnd: end }).returning({ id: statusReports.id }).get().id;
}

function draftOf(db: Db, projectId: number, reportId: number) {
	const r = db.select().from(statusReports).where(and(eq(statusReports.id, reportId), eq(statusReports.projectId, projectId))).get();
	if (!r) throw new ReportError('Laporan tidak ditemukan.');
	if (r.sentAt) throw new ReportError('Laporan sudah terkirim dan diarsipkan; tidak dapat diubah.');
	return r;
}

export type Narrative = { achievements: string; obstacles: string; nextWeek: string; helpNeeded: string };

export function saveNarrative(db: Db, projectId: number, reportId: number, n: Narrative) {
	draftOf(db, projectId, reportId);
	for (const v of Object.values(n)) if (v.length > 5000) throw new ReportError('Setiap bagian narasi maksimal 5000 karakter.');
	db.update(statusReports).set(n).where(eq(statusReports.id, reportId)).run();
}

/** Data otomatis laporan pada `today` (untuk draf; laporan terkirim memakai snapshot). */
export function liveReportData(db: Db, projectId: number, period: { start: string; end: string }, today: string) {
	const p = getProject(db, projectId);
	if (!p) throw new ReportError('Proyek tidak ditemukan.');
	return buildReport(statusInputFrom(p, today), period);
}

/** Tandai terkirim: data otomatis dibekukan, laporan tidak dapat diubah lagi. */
export function sendReport(db: Db, projectId: number, reportId: number, today: string) {
	const r = draftOf(db, projectId, reportId);
	const snapshot = liveReportData(db, projectId, { start: r.periodStart, end: r.periodEnd }, today);
	db.update(statusReports).set({ snapshot, sentAt: new Date() }).where(eq(statusReports.id, reportId)).run();
}

export function deleteDraftReport(db: Db, projectId: number, reportId: number) {
	draftOf(db, projectId, reportId);
	db.delete(statusReports).where(eq(statusReports.id, reportId)).run();
}

export function getReport(db: Db, reportId: number) {
	return db.select().from(statusReports).where(eq(statusReports.id, reportId)).get() ?? null;
}
