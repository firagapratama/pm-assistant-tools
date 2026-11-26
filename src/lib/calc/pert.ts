// PRD 7.1. Semua nilai dalam jam.

export type Priority = 'must' | 'should' | 'could';

export interface ThreePoint {
	o: number;
	m: number;
	p: number;
}

export interface FeatureEffortInput {
	priority: Priority;
	/** roleId → O/M/P dalam jam */
	efforts: Map<number, ThreePoint> | Record<number, ThreePoint>;
}

export interface RoleEffort {
	o: number;
	m: number;
	p: number;
	/** Σ E × faktor kalibrasi */
	e: number;
	/** √(Σ σ²) × faktor kalibrasi */
	sigma: number;
}

export const pertE = ({ o, m, p }: ThreePoint) => (o + 4 * m + p) / 6;
export const pertSigma = ({ o, p }: ThreePoint) => (p - o) / 6;

/** Aturan F4: 0 ≤ O ≤ M ≤ P. */
export const isOrdered = ({ o, m, p }: ThreePoint) =>
	Number.isFinite(o) && Number.isFinite(m) && Number.isFinite(p) && 0 <= o && o <= m && m <= p;

const entries = (efforts: FeatureEffortInput['efforts']): [number, ThreePoint][] =>
	efforts instanceof Map
		? [...efforts]
		: Object.entries(efforts).map(([k, v]) => [Number(k), v]);

/** Total effort per peran. `priorities` menyaring fitur (skenario "hanya Must-have"). */
export function aggregateEffort(
	features: FeatureEffortInput[],
	opts: { priorities?: Priority[]; calibration?: Map<number, number> } = {}
): Map<number, RoleEffort> {
	const sums = new Map<number, { o: number; m: number; p: number; e: number; var: number }>();
	for (const f of features) {
		if (opts.priorities && !opts.priorities.includes(f.priority)) continue;
		for (const [roleId, t] of entries(f.efforts)) {
			const s = sums.get(roleId) ?? { o: 0, m: 0, p: 0, e: 0, var: 0 };
			s.o += t.o;
			s.m += t.m;
			s.p += t.p;
			s.e += pertE(t);
			s.var += pertSigma(t) ** 2;
			sums.set(roleId, s);
		}
	}
	const result = new Map<number, RoleEffort>();
	for (const [roleId, s] of sums) {
		const k = opts.calibration?.get(roleId) ?? 1;
		result.set(roleId, { o: s.o * k, m: s.m * k, p: s.p * k, e: s.e * k, sigma: Math.sqrt(s.var) * k });
	}
	return result;
}
