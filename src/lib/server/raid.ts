// RAID log proyek (PRD F11).
import { and, eq } from 'drizzle-orm';
import { RAID_STATUSES, RAID_TYPES, type RaidStatus, type RaidType } from '../raid.ts';
import type { Db } from './db/index.ts';
import { raidItems } from './db/schema.ts';

export class RaidError extends Error {}

export interface RaidInput {
	type: RaidType;
	description: string;
	owner: string;
	impact: number | null;
	likelihood: number | null;
	mitigation: string;
	reviewDate: string | null;
	status: RaidStatus;
}

const scale = (n: number | null, label: string) => {
	if (n === null) return null;
	if (!Number.isInteger(n) || n < 1 || n > 5) throw new RaidError(`${label} harus 1–5.`);
	return n;
};

function clean(input: RaidInput): RaidInput {
	if (!RAID_TYPES.includes(input.type)) throw new RaidError('Jenis RAID tidak dikenal.');
	if (!RAID_STATUSES.includes(input.status)) throw new RaidError('Status tidak dikenal.');
	const description = input.description.trim();
	if (!description) throw new RaidError('Deskripsi belum diisi.');
	if (description.length > 2000) throw new RaidError('Deskripsi maksimal 2000 karakter.');
	if (input.owner.trim().length > 120) throw new RaidError('Pemilik maksimal 120 karakter.');
	if (input.mitigation.length > 2000) throw new RaidError('Mitigasi maksimal 2000 karakter.');
	if (input.reviewDate !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(input.reviewDate) || Number.isNaN(Date.parse(input.reviewDate))))
		throw new RaidError('Tanggal tinjau tidak valid.');
	return {
		...input,
		description,
		owner: input.owner.trim(),
		impact: scale(input.impact, 'Dampak'),
		// Kemungkinan hanya untuk risiko (F11).
		likelihood: input.type === 'risk' ? scale(input.likelihood, 'Kemungkinan') : null,
		mitigation: input.mitigation.trim()
	};
}

export function saveRaid(db: Db, projectId: number, id: number | null, input: RaidInput): number {
	const values = { ...clean(input), updatedAt: new Date() };
	if (id === null) return db.insert(raidItems).values({ ...values, projectId }).returning({ id: raidItems.id }).get().id;
	const res = db.update(raidItems).set(values).where(and(eq(raidItems.id, id), eq(raidItems.projectId, projectId))).run();
	if (res.changes === 0) throw new RaidError('Item RAID tidak ada di proyek ini.');
	return id;
}

export function deleteRaid(db: Db, projectId: number, id: number) {
	db.delete(raidItems).where(and(eq(raidItems.id, id), eq(raidItems.projectId, projectId))).run();
}
