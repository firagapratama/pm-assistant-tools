// PRD 7.2.
import type { EstimateSettings } from './settings';

export interface TeamMember {
	roleId: number;
	/** Jumlah orang; boleh desimal (0,5 = paruh waktu). */
	mp: number;
	/** Bulan keterlibatan; null = sepanjang proyek. */
	months: number | null;
}

export interface RoleSprint {
	roleId: number;
	effort: number;
	mp: number;
	capacity: number;
	/** null bila effort > 0 tetapi MP = 0 (peringatan F5). */
	sprints: number | null;
}

export interface SprintPlan {
	roles: RoleSprint[];
	bottleneckRoleId: number | null;
	/** Peran yang punya effort tetapi tidak punya orang. */
	unstaffedRoleIds: number[];
	devSprintsRaw: number;
	devSprints: number;
	totalSprints: number;
	weeks: number;
	months: number;
}

// Toleransi agar 5,000000001 tidak dibulatkan ke 6 karena galat floating point.
const EPS = 1e-9;
export const roundUp = (x: number) => Math.ceil(x - EPS);

export const hoursPerPersonPerSprint = (s: EstimateSettings) =>
	s.workDaysPerSprint * s.effectiveHoursPerDay * s.focusFactor;

/** Batas aman jumlah sprint saat menelusuri kapasitas per sprint. */
const MAX_SPRINTS = 1000;

/**
 * Sprint yang dibutuhkan untuk menyelesaikan `effort` dengan kapasitas normal `capacity` per sprint.
 * `factor(i)` adalah porsi kapasitas yang tersedia di sprint ke-i (libur mengurangi hari kerja).
 */
export function sprintsNeeded(effort: number, capacity: number, factor?: (i: number) => number): number {
	if (effort <= 0) return 0;
	if (!factor) return effort / capacity;
	let remaining = effort;
	for (let i = 0; i < MAX_SPRINTS; i++) {
		const cap = capacity * factor(i);
		if (cap > 0 && remaining <= cap + EPS) return i + remaining / cap;
		remaining -= cap;
	}
	return MAX_SPRINTS;
}

export function sprintPlan(
	effortByRole: Map<number, number>,
	team: TeamMember[],
	s: EstimateSettings,
	factor?: (i: number) => number
): SprintPlan {
	const perPerson = hoursPerPersonPerSprint(s);
	const mpByRole = new Map(team.map((t) => [t.roleId, t.mp]));
	const roleIds = new Set([...effortByRole.keys(), ...mpByRole.keys()]);

	const roles: RoleSprint[] = [];
	const unstaffedRoleIds: number[] = [];
	let bottleneckRoleId: number | null = null;
	let devSprintsRaw = 0;

	for (const roleId of roleIds) {
		const effort = effortByRole.get(roleId) ?? 0;
		const mp = mpByRole.get(roleId) ?? 0;
		const capacity = mp * perPerson;
		let sprints: number | null = 0;
		if (effort > 0 && capacity <= 0) {
			sprints = null;
			unstaffedRoleIds.push(roleId);
		} else if (effort > 0) {
			sprints = sprintsNeeded(effort, capacity, factor);
		}
		if (sprints !== null && sprints > devSprintsRaw) {
			devSprintsRaw = sprints;
			bottleneckRoleId = roleId;
		}
		roles.push({ roleId, effort, mp, capacity, sprints });
	}

	const devSprints = roundUp(devSprintsRaw);
	const totalSprints = devSprints + s.stabilizationSprints;
	const weeks = totalSprints * s.sprintWeeks;
	return {
		roles,
		bottleneckRoleId,
		unstaffedRoleIds,
		devSprintsRaw,
		devSprints,
		totalSprints,
		weeks,
		months: weeks / s.weeksPerMonth
	};
}

/**
 * Jumlah orang minimum per peran agar effort selesai dalam `targetDevSprints` sprint pengembangan.
 * Kapasitas per sprint mengikuti `factor` (libur), dibulatkan ke atas per `step` orang (default 0,5).
 * Peran tanpa effort tidak disarankan (misalnya PM, dialokasikan manual).
 */
export function suggestTeam(
	effortByRole: Map<number, number>,
	s: EstimateSettings,
	targetDevSprints: number,
	factor: (i: number) => number = () => 1,
	step = 0.5
): Map<number, number> {
	const perPerson = hoursPerPersonPerSprint(s);
	let sprintCapacity = 0; // jumlah porsi kapasitas dalam target, mis. 3 sprint dengan Lebaran = 0,4 + 0,8 + 1
	const whole = Math.floor(targetDevSprints);
	for (let i = 0; i < whole; i++) sprintCapacity += factor(i);
	sprintCapacity += (targetDevSprints - whole) * factor(whole);

	const result = new Map<number, number>();
	for (const [roleId, effort] of effortByRole) {
		if (effort <= 0) continue;
		if (sprintCapacity <= 0 || perPerson <= 0) {
			result.set(roleId, Infinity);
			continue;
		}
		const needed = effort / (perPerson * sprintCapacity);
		result.set(roleId, Math.max(step, Math.ceil(needed / step - EPS) * step));
	}
	return result;
}
