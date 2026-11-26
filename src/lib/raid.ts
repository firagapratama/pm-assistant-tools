// RAID log (PRD F11): Risks, Assumptions, Issues, Dependencies.

export const RAID_TYPES = ['risk', 'assumption', 'issue', 'dependency'] as const;
export type RaidType = (typeof RAID_TYPES)[number];
export const RAID_TYPE_LABEL: Record<RaidType, string> = {
	risk: 'Risiko',
	assumption: 'Asumsi',
	issue: 'Isu',
	dependency: 'Dependensi'
};

export const RAID_STATUSES = ['terbuka', 'dipantau', 'selesai'] as const;
export type RaidStatus = (typeof RAID_STATUSES)[number];
export const RAID_STATUS_LABEL: Record<RaidStatus, string> = { terbuka: 'Terbuka', dipantau: 'Dipantau', selesai: 'Selesai' };

/** Skor risiko ≥ 15 dikategorikan tinggi (F11). */
export const HIGH_RISK = 15;

export interface RaidLike {
	type: RaidType;
	impact: number | null;
	likelihood: number | null;
	status: RaidStatus;
	reviewDate: string | null;
	mitigation: string;
}

/** Skor = dampak × kemungkinan; hanya untuk risiko yang keduanya sudah dinilai. */
export const raidScore = (r: Pick<RaidLike, 'type' | 'impact' | 'likelihood'>) =>
	r.type === 'risk' && r.impact && r.likelihood ? r.impact * r.likelihood : null;

export type Severity = 'tinggi' | 'sedang' | 'rendah';
export const severity = (score: number | null): Severity | null =>
	score === null ? null : score >= HIGH_RISK ? 'tinggi' : score >= 8 ? 'sedang' : 'rendah';

export const isOpen = (r: Pick<RaidLike, 'status'>) => r.status !== 'selesai';

/** Lewat tanggal tinjau ulang dan belum selesai. */
export const reviewOverdue = (r: Pick<RaidLike, 'status' | 'reviewDate'>, today: string) =>
	isOpen(r) && !!r.reviewDate && r.reviewDate < today;

export const isHighRisk = (r: RaidLike) => isOpen(r) && (raidScore(r) ?? 0) >= HIGH_RISK;
