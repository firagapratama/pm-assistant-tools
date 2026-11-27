// Perhitungan dan pemeriksaan estimasi yang dipakai bersama oleh editor (browser) dan server.
import { WorkCalendar, computeScenario, type Holiday, type ScenarioResult } from './calc/index.ts';
import type { DraftScenario, EstimateDraft } from './validation/estimate.ts';

/** Peran + rate yang disalin ke estimasi saat dibuat. */
export interface RateSnapshot {
	roleId: number;
	name: string;
	level: string | null;
	source: string;
	monthlyRate: number | null;
}

/** Kalender kerja estimasi; null bila rencana mulai belum diisi (libur tidak diperhitungkan). */
export const calendarFor = (draft: EstimateDraft, holidays: Holiday[]) =>
	draft.plannedStart ? new WorkCalendar(draft.plannedStart, draft.settings, holidays) : null;

export function computeDraft(draft: EstimateDraft, rates: RateSnapshot[], holidays: Holiday[] = []): ScenarioResult {
	return computeScenario({
		sprintFactor: calendarFor(draft, holidays)?.factor,
		features: draft.features,
		team: draft.team,
		rates: new Map(rates.filter((r) => r.monthlyRate !== null).map((r) => [r.roleId, r.monthlyRate!])),
		overhead: draft.overhead,
		settings: draft.settings
	});
}

/** Hasil skenario alternatif (PRD F7): tim skenario, dan hanya fitur dengan prioritas yang dipilih. */
export function computeAlternative(draft: EstimateDraft, scenario: DraftScenario, rates: RateSnapshot[], holidays: Holiday[] = []): ScenarioResult {
	const features = scenario.priorities ? draft.features.filter((f) => scenario.priorities!.includes(f.priority)) : draft.features;
	return computeDraft({ ...draft, features, team: scenario.team }, rates, holidays);
}

/** Masalah yang menghalangi finalisasi; kosong berarti siap. */
export function finalizeProblems(draft: EstimateDraft, rates: RateSnapshot[], result: ScenarioResult): string[] {
	const name = (id: number) => rates.find((r) => r.roleId === id)?.name ?? `Peran #${id}`;
	const problems: string[] = [];
	if (draft.features.length === 0) problems.push('Belum ada fitur.');
	if (draft.features.some((f) => !f.name.trim())) problems.push('Ada fitur yang belum diberi nama.');
	const aiDrafts = draft.features.filter((f) => f.aiDraft).length;
	if (aiDrafts) problems.push(`${aiDrafts} fitur draf AI belum ditinjau. Setujui atau ubah dulu.`);
	if (draft.features.length > 0 && result.totalEffort.e === 0) problems.push('Belum ada effort yang diisi.');
	for (const id of result.likely.sprint.unstaffedRoleIds) problems.push(`${name(id)} punya effort tetapi belum ada orangnya di Tim.`);
	for (const id of result.likely.cost.missingRateRoleIds) problems.push(`Rate ${name(id)} belum diisi. Tambahkan di Pengaturan, lalu ambil rate & kalender terbaru.`);
	return problems;
}
