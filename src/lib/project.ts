// Baseline proyek (PRD F9): angka yang disepakati saat Deal, dibekukan agar tidak berubah diam-diam.

export interface ProjectBaseline {
	estimateVersion: number;
	devSprints: number;
	totalSprints: number;
	sprintsLow: number;
	sprintsHigh: number;
	weeks: number;
	months: number;
	/** Hari kerja terakhir sprint terakhir (YYYY-MM-DD). */
	endDate: string;
	effortHours: number;
	sigmaHours: number;
	labor: number;
	overhead: number;
	subtotal: number;
	contingency: number;
	total: number;
	price: number;
	priceLow: number;
	priceHigh: number;
	margin: number;
	tmTotal: number;
	tmMonthlyRate: number;
	team: { roleId: number; name: string; mp: number; months: number; rate: number; amount: number }[];
}

/** Batas sprint rencana di Gantt: baseline ditambah ±setengah tahun kelonggaran. */
export const maxPlanSprint = (baselineSprints: number) => baselineSprints + 13;

/** Progres keseluruhan, ditimbang dengan effort fitur (0–100). */
export function weightedProgress(rows: { effortHours: number; progress: number }[]): number {
	const total = rows.reduce((a, r) => a + r.effortHours, 0);
	return total > 0 ? rows.reduce((a, r) => a + r.effortHours * r.progress, 0) / total : 0;
}
