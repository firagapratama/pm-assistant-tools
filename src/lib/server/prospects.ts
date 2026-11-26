// Pipeline prospek (PRD F2).
import { and, asc, count, desc, eq, max, ne, sql } from 'drizzle-orm';
import type { ProspectStatus } from '../labels.ts';
import type { ProspectInput } from '../validation/prospect.ts';
import type { Db, DbLike } from './db/index.ts';
import { estimates, prospects, statusHistory } from './db/schema.ts';

export class StatusChangeError extends Error {}

export interface ProspectFilter {
	q?: string;
	status?: ProspectStatus | '';
	client?: string;
}

const lastChange = (db: Db) =>
	db
		.select({ prospectId: statusHistory.prospectId, at: max(statusHistory.createdAt).as('at') })
		.from(statusHistory)
		.groupBy(statusHistory.prospectId)
		.as('last_change');

export function listProspects(db: Db, f: ProspectFilter = {}) {
	const lc = lastChange(db);
	return db
		.select({
			id: prospects.id,
			name: prospects.name,
			client: prospects.client,
			deadline: prospects.deadline,
			budget: prospects.budget,
			status: prospects.status,
			createdAt: prospects.createdAt,
			statusSince: sql<number>`coalesce(${lc.at}, ${prospects.createdAt})`.mapWith(
				(s: number) => new Date(s * 1000)
			)
		})
		.from(prospects)
		.leftJoin(lc, eq(lc.prospectId, prospects.id))
		.where(
			and(
				f.q ? sql`instr(lower(${prospects.name}), ${f.q.toLowerCase()}) > 0` : undefined,
				f.status ? eq(prospects.status, f.status) : undefined,
				f.client ? eq(prospects.client, f.client) : undefined
			)
		)
		.orderBy(desc(prospects.createdAt), desc(prospects.id))
		.all();
}

export type ProspectListItem = ReturnType<typeof listProspects>[number];

export function listClients(db: Db): string[] {
	return db
		.selectDistinct({ client: prospects.client })
		.from(prospects)
		.where(ne(prospects.client, ''))
		.orderBy(asc(prospects.client))
		.all()
		.map((r) => r.client);
}

export function getProspect(db: Db, id: number) {
	const prospect = db.select().from(prospects).where(eq(prospects.id, id)).get();
	if (!prospect) return null;
	const history = db
		.select()
		.from(statusHistory)
		.where(eq(statusHistory.prospectId, id))
		.orderBy(desc(statusHistory.createdAt), desc(statusHistory.id))
		.all();
	return { prospect, history, hasFinalEstimate: hasFinalEstimate(db, id) };
}

function hasFinalEstimate(db: DbLike, prospectId: number) {
	return !!db
		.select({ id: estimates.id })
		.from(estimates)
		.where(and(eq(estimates.prospectId, prospectId), eq(estimates.isFinal, true)))
		.get();
}

export function createProspect(db: Db, input: ProspectInput): number {
	return db.transaction((tx) => {
		const { id } = tx.insert(prospects).values(input).returning({ id: prospects.id }).get();
		tx.insert(statusHistory).values({ prospectId: id, from: null, to: 'prospek' }).run();
		return id;
	});
}

export function updateProspect(db: Db, id: number, input: ProspectInput) {
	db.update(prospects).set(input).where(eq(prospects.id, id)).run();
}

/**
 * Pemeriksaan perubahan status (F2): status harus berubah; prospek Deal terkunci;
 * Batal wajib beralasan; Deal butuh versi estimasi final.
 */
export function checkStatusChange(db: DbLike, id: number, to: ProspectStatus, cancelReason = '') {
	const current = db.select({ status: prospects.status }).from(prospects).where(eq(prospects.id, id)).get();
	if (!current) throw new StatusChangeError('Prospek tidak ditemukan.');
	if (current.status === to) throw new StatusChangeError('Status tidak berubah.');
	if (current.status === 'deal')
		throw new StatusChangeError('Prospek sudah Deal. Perubahan setelah deal dilakukan lewat change request proyek.');
	if (to === 'batal' && !cancelReason.trim()) throw new StatusChangeError('Tuliskan alasan prospek dibatalkan.');
	if (to === 'deal' && !hasFinalEstimate(db, id))
		throw new StatusChangeError('Tandai satu versi estimasi sebagai final sebelum mengubah status menjadi Deal.');
	return current.status;
}

/** Menulis status baru dan riwayatnya (dipanggil di dalam transaksi). */
export function writeStatus(
	tx: DbLike,
	id: number,
	from: ProspectStatus,
	to: ProspectStatus,
	opts: { note?: string; cancelReason?: string } = {}
) {
	const cancelReason = opts.cancelReason?.trim() ?? '';
	tx.update(prospects)
		.set({ status: to, cancelReason: to === 'batal' ? cancelReason : null })
		.where(eq(prospects.id, id))
		.run();
	tx.insert(statusHistory)
		.values({
			prospectId: id,
			from,
			to,
			note: to === 'batal' ? [cancelReason, opts.note?.trim()].filter(Boolean).join('\n\n') : (opts.note?.trim() ?? '')
		})
		.run();
}

/** Mengubah status prospek. Deal dilakukan lewat `dealProspect` karena sekaligus membuat proyek (F9). */
export function changeStatus(
	db: Db,
	id: number,
	to: ProspectStatus,
	opts: { note?: string; cancelReason?: string } = {}
) {
	if (to === 'deal') throw new StatusChangeError('Deal harus disertai tanggal mulai proyek.');
	const from = checkStatusChange(db, id, to, opts.cancelReason);
	db.transaction((tx) => writeStatus(tx, id, from, to, opts));
}

/** Ringkasan data yang ikut terhapus bersama prospek, untuk konfirmasi. */
export function deletionImpact(db: Db, id: number) {
	const row = db
		.select({ n: count(), finals: sql<number>`coalesce(sum(${estimates.isFinal}), 0)` })
		.from(estimates)
		.where(eq(estimates.prospectId, id))
		.get();
	return { estimates: row?.n ?? 0, finalEstimates: Number(row?.finals ?? 0) };
}

/**
 * Menghapus prospek secara permanen beserta riwayat status dan semua versi estimasinya (cascade).
 * Prospek Deal tidak bisa dihapus karena proyek dibuat dari baseline-nya (F9).
 */
export function deleteProspect(db: Db, id: number) {
	const current = db.select({ status: prospects.status }).from(prospects).where(eq(prospects.id, id)).get();
	if (!current) throw new StatusChangeError('Prospek tidak ditemukan.');
	if (current.status === 'deal') throw new StatusChangeError('Prospek yang sudah Deal tidak dapat dihapus karena sudah menjadi proyek.');
	db.delete(prospects).where(eq(prospects.id, id)).run();
}
