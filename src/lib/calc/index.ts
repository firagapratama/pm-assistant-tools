// Mesin kalkulasi murni (tech-stack 4.1): dipakai di browser dan dijalankan ulang di server.
import { aggregateEffort, type FeatureEffortInput, type Priority, type RoleEffort } from './pert';
import { sprintPlan, type SprintPlan, type TeamMember } from './capacity';
import { costPlan, type CostPlan, type OverheadItem } from './cost';
import type { EstimateSettings } from './settings';

export * from './settings';
export * from './units';
export * from './pert';
export * from './capacity';
export * from './cost';
export * from './calendar';
export * from './schedule';

export interface ScenarioInput {
	features: FeatureEffortInput[];
	team: TeamMember[];
	/** roleId → rate bulanan (Rp), dari snapshot estimasi. */
	rates: Map<number, number>;
	overhead: OverheadItem[];
	settings: EstimateSettings;
	priorities?: Priority[];
	calibration?: Map<number, number>;
	/** Porsi kapasitas per sprint dari kalender kerja (libur); tanpa ini setiap sprint penuh. */
	sprintFactor?: (i: number) => number;
}

export interface PlanPoint {
	sprint: SprintPlan;
	cost: CostPlan;
}

export interface ScenarioResult {
	effort: Map<number, RoleEffort>;
	/** Total seluruh peran. */
	totalEffort: RoleEffort;
	/** Nilai paling mungkin (E). */
	likely: PlanPoint;
	/** E ∓ rangeSigma·σ (PRD 7.4). */
	low: PlanPoint;
	high: PlanPoint;
	/** Seluruh effort di O dan di P: ujung pita rentang. */
	optimistic: PlanPoint;
	pessimistic: PlanPoint;
}

function planFor(effort: Map<number, number>, input: ScenarioInput): PlanPoint {
	const sprint = sprintPlan(effort, input.team, input.settings, input.sprintFactor);
	const cost = costPlan(input.team, input.rates, sprint.months, input.overhead, input.settings, sprint.totalSprints);
	return { sprint, cost };
}

const mapValues = <T>(m: Map<number, RoleEffort>, f: (r: RoleEffort) => T) =>
	new Map([...m].map(([k, v]) => [k, f(v)]));

export function computeScenario(input: ScenarioInput): ScenarioResult {
	const effort = aggregateEffort(input.features, {
		priorities: input.priorities,
		calibration: input.calibration
	});
	const k = input.settings.rangeSigma;

	let o = 0, m = 0, p = 0, e = 0, variance = 0;
	for (const r of effort.values()) {
		o += r.o; m += r.m; p += r.p; e += r.e; variance += r.sigma ** 2;
	}

	return {
		effort,
		totalEffort: { o, m, p, e, sigma: Math.sqrt(variance) },
		likely: planFor(mapValues(effort, (r) => r.e), input),
		low: planFor(mapValues(effort, (r) => Math.max(0, r.e - k * r.sigma)), input),
		high: planFor(mapValues(effort, (r) => r.e + k * r.sigma), input),
		optimistic: planFor(mapValues(effort, (r) => r.o), input),
		pessimistic: planFor(mapValues(effort, (r) => r.p), input)
	};
}
