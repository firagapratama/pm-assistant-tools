// Ketersediaan tim per proyek: catat cuti, sakit, dan lembur per peran beserta tanggalnya.
import { and, asc, eq } from 'drizzle-orm';
import { AVAILABILITY_KINDS, type AvailabilityKind } from '../availability.ts';
import type { Db } from './db/index.ts';
import { projectAvailability, projects } from './db/schema.ts';

export class AvailabilityError extends Error {}

export interface AvailabilityInput {
	roleId: number;
	kind: AvailabilityKind;
	people: number;
	startDate: string;
	endDate: string;
	hours: number;
	note: string;
}

const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

export function listAvailability(db: Db, projectId: number) {
	return db.select().from(projectAvailability).where(eq(projectAvailability.projectId, projectId)).orderBy(asc(projectAvailability.startDate), asc(projectAvailability.id)).all();
}

/** Tambah (id = null) atau ubah catatan. Peran harus ada di tim baseline proyek. */
export function saveAvailability(db: Db, projectId: number, id: number | null, input: AvailabilityInput): number {
	const project = db.select({ baseline: projects.baseline }).from(projects).where(eq(projects.id, projectId)).get();
	if (!project) throw new AvailabilityError('Proyek tidak ditemukan.');
	if (!project.baseline.team.some((t) => t.roleId === input.roleId)) throw new AvailabilityError('Pilih peran yang ada di tim proyek.');
	if (!AVAILABILITY_KINDS.includes(input.kind)) throw new AvailabilityError('Jenis tidak dikenal.');
	if (!isDate(input.startDate) || !isDate(input.endDate)) throw new AvailabilityError('Tanggal tidak valid.');
	if (input.endDate < input.startDate) throw new AvailabilityError('Tanggal selesai tidak boleh sebelum tanggal mulai.');
	if (!(Number.isFinite(input.people) && input.people > 0 && input.people <= 100)) throw new AvailabilityError('Jumlah orang harus lebih dari 0.');
	const hours = input.kind === 'lembur' ? input.hours : 0;
	if (input.kind === 'lembur' && !(Number.isFinite(hours) && hours > 0 && hours <= 12)) throw new AvailabilityError('Jam lembur per hari harus 0–12.');
	const note = input.note.trim();
	if (note.length > 300) throw new AvailabilityError('Catatan maksimal 300 karakter.');
	const row = { roleId: input.roleId, kind: input.kind, people: input.people, startDate: input.startDate, endDate: input.endDate, hours, note };
	if (id !== null) {
		const res = db.update(projectAvailability).set(row).where(and(eq(projectAvailability.id, id), eq(projectAvailability.projectId, projectId))).run();
		if (!res.changes) throw new AvailabilityError('Catatan tidak ada di proyek ini.');
		return id;
	}
	return db.insert(projectAvailability).values({ ...row, projectId }).returning({ id: projectAvailability.id }).get().id;
}

export function deleteAvailability(db: Db, projectId: number, id: number) {
	db.delete(projectAvailability).where(and(eq(projectAvailability.id, id), eq(projectAvailability.projectId, projectId))).run();
}
