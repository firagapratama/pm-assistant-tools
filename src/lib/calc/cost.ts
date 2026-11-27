// PRD 7.3. Rupiah selalu integer; setiap baris dibulatkan ke rupiah terdekat
// sehingga rincian yang tampil selalu berjumlah tepat sama dengan subtotal.
import type { TeamMember } from './capacity';
import type { EstimateSettings } from './settings';

export interface OverheadItem {
	label: string;
	amount: number;
}

export interface RoleCost {
	roleId: number;
	mp: number;
	rate: number;
	months: number;
	amount: number;
}

export interface CostPlan {
	roles: RoleCost[];
	/** Upah lembur seluruh tim (0 bila tidak direncanakan lembur). */
	overtime: number;
	/** Peran di tim yang belum punya rate. */
	missingRateRoleIds: number[];
	labor: number;
	overhead: number;
	subtotal: number;
	contingency: number;
	total: number;
	price: number;
	/** (harga − biaya) / harga, informasi saja. */
	margin: number;
	/** Sudut pandang time & material: biaya × (1 + markup), tanpa contingency (risiko ditanggung klien). */
	tmTotal: number;
	/** Tarif tim per bulan untuk T&M: Σ MP × rate × (1 + markup). */
	tmMonthlyRate: number;
}

/** amount × bp / 10000, dibulatkan setengah ke atas, tanpa galat floating point. */
export function applyBp(amount: number, bp: number): number {
	const n = BigInt(amount) * BigInt(bp);
	const sign = n < 0n ? -1n : 1n;
	return Number((sign * (sign * n * 2n + 10000n)) / 20000n);
}

/** Upah sejam = 1/173 upah sebulan (PP 35/2021 Pasal 31). */
export const OVERTIME_HOURLY_DIVISOR = 173;

/**
 * Pengali rata-rata upah lembur hari kerja (PP 35/2021): jam pertama ×1,5, jam berikutnya ×2.
 * Lembur per sprint dibagi rata ke hari kerja sprint.
 */
export function overtimePayFactor(hoursPerSprint: number, workDaysPerSprint: number): number {
	if (hoursPerSprint <= 0 || workDaysPerSprint <= 0) return 0;
	const perDay = hoursPerSprint / workDaysPerSprint;
	return (Math.min(perDay, 1) * 1.5 + Math.max(perDay - 1, 0) * 2) / perDay;
}

export function costPlan(
	team: TeamMember[],
	rates: Map<number, number>,
	durationMonths: number,
	overheadItems: OverheadItem[],
	s: EstimateSettings,
	/** Jumlah sprint (untuk upah lembur per sprint). */
	sprints = 0
): CostPlan {
	const missingRateRoleIds: number[] = [];
	const roles = team.map((t): RoleCost => {
		const rate = rates.get(t.roleId);
		if (rate === undefined && t.mp > 0) missingRateRoleIds.push(t.roleId);
		const months = t.months ?? durationMonths;
		return { roleId: t.roleId, mp: t.mp, rate: rate ?? 0, months, amount: Math.round(t.mp * (rate ?? 0) * months) };
	});
	const labor = roles.reduce((a, r) => a + r.amount, 0);
	const ot = s.overtimeHoursPerSprint ?? 0;
	const otFactor = overtimePayFactor(ot, s.workDaysPerSprint);
	const overtime = roles.reduce((a, r) => a + Math.round((r.mp * ot * sprints * r.rate * otFactor) / OVERTIME_HOURLY_DIVISOR), 0);
	const overhead = overheadItems.reduce((a, o) => a + Math.round(o.amount), 0);
	const subtotal = labor + overtime + overhead;
	const contingency = applyBp(subtotal, s.contingencyBp);
	const total = subtotal + contingency;
	const price = total + applyBp(total, s.markupBp);
	const monthlyCost = roles.reduce((a, r) => a + Math.round(r.mp * r.rate), 0);
	return {
		tmTotal: subtotal + applyBp(subtotal, s.markupBp),
		tmMonthlyRate: monthlyCost + applyBp(monthlyCost, s.markupBp),
		roles,
		missingRateRoleIds,
		labor,
		overtime,
		overhead,
		subtotal,
		contingency,
		total,
		price,
		margin: price === 0 ? 0 : (price - total) / price
	};
}
