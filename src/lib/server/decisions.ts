// Decision log (PRD F12): keputusan tidak dihapus. Pembatalan = keputusan baru yang merujuk keputusan lama.
import { and, eq, max } from 'drizzle-orm';
import type { Db } from './db/index.ts';
import { decisions, projects } from './db/schema.ts';

export class DecisionError extends Error {}

export interface DecisionInput {
	date: string;
	decision: string;
	decidedBy: string;
	reason: string;
	alternatives: string;
	impact: string;
	link: string;
	/** Hanya saat membuat: keputusan lama yang dibatalkan/digantikan. */
	supersedesId: number | null;
}

function text(value: string, maxLen: number, label: string) {
	const v = value.trim();
	if (v.length > maxLen) throw new DecisionError(`${label} maksimal ${maxLen} karakter.`);
	return v;
}

function clean(input: DecisionInput) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(Date.parse(input.date))) throw new DecisionError('Tanggal tidak valid.');
	const decision = text(input.decision, 2000, 'Keputusan');
	if (!decision) throw new DecisionError('Keputusan belum diisi.');
	const link = text(input.link, 500, 'Tautan');
	if (link && !/^https?:\/\/\S+$/i.test(link)) throw new DecisionError('Tautan harus diawali http:// atau https://.');
	return {
		date: input.date,
		decision,
		decidedBy: text(input.decidedBy, 120, 'Pengambil keputusan'),
		reason: text(input.reason, 2000, 'Alasan'),
		alternatives: text(input.alternatives, 2000, 'Alternatif'),
		impact: text(input.impact, 2000, 'Dampak'),
		link
	};
}

/** Tambah (id = null) atau perbaiki isi keputusan. Rujukan pembatalan hanya ditetapkan saat membuat. */
export function saveDecision(db: Db, projectId: number, id: number | null, input: DecisionInput): number {
	if (!db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).get()) throw new DecisionError('Proyek tidak ditemukan.');
	const data = clean(input);
	if (id !== null) {
		const res = db.update(decisions).set(data).where(and(eq(decisions.id, id), eq(decisions.projectId, projectId))).run();
		if (!res.changes) throw new DecisionError('Keputusan tidak ada di proyek ini.');
		return id;
	}
	if (input.supersedesId !== null) {
		const old = db.select().from(decisions).where(and(eq(decisions.id, input.supersedesId), eq(decisions.projectId, projectId))).get();
		if (!old) throw new DecisionError('Keputusan yang dibatalkan tidak ada di proyek ini.');
		if (db.select({ id: decisions.id }).from(decisions).where(eq(decisions.supersedesId, old.id)).get())
			throw new DecisionError('Keputusan itu sudah dibatalkan oleh keputusan lain.');
		if (data.date < old.date) throw new DecisionError('Tanggal tidak boleh sebelum keputusan yang dibatalkan.');
	}
	const last = db.select({ n: max(decisions.number) }).from(decisions).where(eq(decisions.projectId, projectId)).get()?.n ?? 0;
	return db
		.insert(decisions)
		.values({ ...data, projectId, number: last + 1, supersedesId: input.supersedesId })
		.returning({ id: decisions.id })
		.get().id;
}

/** Semua keputusan proyek, terbaru dulu, dengan rujukan dua arah (membatalkan / dibatalkan oleh). */
export function listDecisions(db: Db, projectId: number) {
	const rows = db.select().from(decisions).where(eq(decisions.projectId, projectId)).all();
	const num = (id: number | null) => (id === null ? null : (rows.find((r) => r.id === id)?.number ?? null));
	return rows
		.map((r) => {
			const by = rows.find((x) => x.supersedesId === r.id);
			return { ...r, supersedesNumber: num(r.supersedesId), supersededByNumber: by?.number ?? null };
		})
		.sort((a, b) => b.number - a.number);
}
