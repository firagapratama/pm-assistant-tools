// Penjadwalan fitur ke sprint untuk Gantt: setiap peran mengerjakan fitur sesuai urutan baseline,
// paralel dengan peran lain, memakai kapasitas per sprint (orang × jam × focus factor × porsi hari kerja).
import { hoursPerPersonPerSprint, type TeamMember } from './capacity';
import { pertE, type ThreePoint } from './pert';
import type { EstimateSettings } from './settings';

export interface ScheduleFeature {
	id: number;
	/** roleId → O/M/P (jam) */
	efforts: Record<number, ThreePoint>;
}

/** Rentang sprint (1-based, inklusif). */
export interface SprintSpan {
	start: number;
	end: number;
}

const EPS = 1e-9;
const MAX_SPRINTS = 1000;

/**
 * Posisi selesai (dalam sprint, pecahan) bila `hours` dikerjakan mulai `from`
 * dengan kapasitas `capacity × factor(i)` per sprint.
 */
function advance(from: number, hours: number, capacity: number, factor: (i: number) => number): number {
	let pos = from;
	let remaining = hours;
	while (remaining > EPS && pos < MAX_SPRINTS) {
		const i = Math.floor(pos + EPS);
		const cap = capacity * factor(i);
		const room = (i + 1 - pos) * cap; // kapasitas tersisa di sprint ini
		if (cap <= 0) {
			pos = i + 1;
			continue;
		}
		if (remaining <= room + EPS) return pos + remaining / cap;
		remaining -= room;
		pos = i + 1;
	}
	return pos;
}

export function planFeatures(
	features: ScheduleFeature[],
	team: TeamMember[],
	s: EstimateSettings,
	factor: (i: number) => number = () => 1
): Map<number, SprintSpan> {
	const perPerson = hoursPerPersonPerSprint(s);
	const capacity = new Map(team.filter((t) => t.mp > 0).map((t) => [t.roleId, t.mp * perPerson]));
	const cursor = new Map<number, number>(); // posisi kerja tiap peran (sprint, pecahan, mulai 0)
	const plan = new Map<number, SprintSpan>();
	let lastEnd = 1;

	for (const f of features) {
		let start = Infinity;
		let end = -Infinity;
		for (const [roleKey, t] of Object.entries(f.efforts)) {
			const roleId = Number(roleKey);
			const hours = pertE(t);
			const cap = capacity.get(roleId);
			if (hours <= 0 || !cap) continue;
			const from = cursor.get(roleId) ?? 0;
			const to = advance(from, hours, cap, factor);
			cursor.set(roleId, to);
			start = Math.min(start, from);
			end = Math.max(end, to);
		}
		if (!Number.isFinite(start)) {
			// Fitur tanpa effort terjadwal ditempatkan di sprint terakhir yang sudah dipakai.
			plan.set(f.id, { start: lastEnd, end: lastEnd });
			continue;
		}
		const span = { start: Math.floor(start + EPS) + 1, end: Math.max(Math.floor(start + EPS) + 1, Math.ceil(end - EPS)) };
		plan.set(f.id, span);
		lastEnd = span.end;
	}
	return plan;
}
