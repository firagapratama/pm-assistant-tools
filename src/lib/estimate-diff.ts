// Perbandingan antarversi estimasi (PRD F7): apa yang berubah dan selisih angkanya.
import type { Holiday } from './calc/calendar.ts';
import { pertE } from './calc/pert.ts';
import type { EstimateSettings } from './calc/settings.ts';
import { computeDraft, type RateSnapshot } from './estimate.ts';
import { roleLabel } from './labels.ts';
import type { DraftFeature, EstimateDraft } from './validation/estimate.ts';

export interface VersionInput {
	version: number;
	draft: EstimateDraft;
	rates: RateSnapshot[];
	holidays: Holiday[];
}

const SETTING_LABEL: Record<keyof EstimateSettings, string> = {
	inputUnit: 'Satuan input',
	spPerHour: 'Story point per jam',
	sprintWeeks: 'Panjang sprint (minggu)',
	workDaysPerSprint: 'Hari kerja per sprint',
	effectiveHoursPerDay: 'Jam efektif per hari',
	focusFactor: 'Focus factor',
	stabilizationSprints: 'Sprint stabilisasi',
	contingencyBp: 'Contingency',
	markupBp: 'Markup',
	weeksPerMonth: 'Minggu per bulan',
	rangeSigma: 'Lebar rentang (σ)',
	leaveDaysPerYear: 'Cuti tahunan (hari/tahun)',
	sickDaysPerYear: 'Sakit (hari/tahun)',
	overtimeHoursPerSprint: 'Lembur (jam/sprint)'
};
const settingText = (k: keyof EstimateSettings, v: EstimateSettings[typeof k]) =>
	k === 'contingencyBp' || k === 'markupBp' ? `${String(Number(v) / 100).replace('.', ',')}%` : k === 'inputUnit' ? (v === 'sp' ? 'Story point' : 'Jam') : String(v).replace('.', ',');

const featureHours = (f: DraftFeature) => Object.values(f.efforts).reduce((a, t) => a + pertE(t), 0);
/** Fitur dicocokkan lewat modul + nama (tanpa beda huruf besar/spasi). */
const keyOf = (f: DraftFeature) => `${f.module.trim().toLowerCase()}|${f.name.trim().toLowerCase()}`;
const lineSet = (t: string) => t.split('\n').map((l) => l.trim()).filter(Boolean);

function totals(v: VersionInput) {
	const r = computeDraft(v.draft, v.rates, v.holidays);
	return {
		features: v.draft.features.length,
		effortHours: r.totalEffort.e,
		sprints: r.likely.sprint.totalSprints,
		weeks: r.likely.sprint.weeks,
		months: r.likely.sprint.months,
		people: v.draft.team.reduce((a, t) => a + t.mp, 0),
		cost: r.likely.cost.total,
		price: r.likely.cost.price
	};
}

export function diffVersions(a: VersionInput, b: VersionInput) {
	const aMap = new Map(a.draft.features.map((f) => [keyOf(f), f]));
	const bMap = new Map(b.draft.features.map((f) => [keyOf(f), f]));
	const added = b.draft.features.filter((f) => !aMap.has(keyOf(f))).map((f) => ({ module: f.module, name: f.name, hours: featureHours(f) }));
	const removed = a.draft.features.filter((f) => !bMap.has(keyOf(f))).map((f) => ({ module: f.module, name: f.name, hours: featureHours(f) }));
	const changed = b.draft.features.flatMap((f) => {
		const old = aMap.get(keyOf(f));
		if (!old) return [];
		const [hoursA, hoursB] = [featureHours(old), featureHours(f)];
		if (Math.abs(hoursA - hoursB) < 0.05 && old.priority === f.priority) return [];
		return [{ module: f.module, name: f.name, hoursA, hoursB, priorityA: old.priority, priorityB: f.priority }];
	});

	const roleName = (id: number) => {
		const r = b.rates.find((x) => x.roleId === id) ?? a.rates.find((x) => x.roleId === id);
		return r ? roleLabel(r) : `Peran #${id}`;
	};
	const mp = (v: VersionInput, id: number) => v.draft.team.find((t) => t.roleId === id)?.mp ?? 0;
	const team = [...new Set([...a.draft.team, ...b.draft.team].map((t) => t.roleId))]
		.map((id) => ({ role: roleName(id), mpA: mp(a, id), mpB: mp(b, id) }))
		.filter((t) => t.mpA !== t.mpB);
	const rate = (v: VersionInput, id: number) => v.rates.find((r) => r.roleId === id)?.monthlyRate ?? null;
	const rates = [...new Set([...a.rates, ...b.rates].map((r) => r.roleId))]
		.map((id) => ({ role: roleName(id), rateA: rate(a, id), rateB: rate(b, id) }))
		.filter((r) => r.rateA !== r.rateB);

	const settings = (Object.keys(SETTING_LABEL) as (keyof EstimateSettings)[])
		.filter((k) => a.draft.settings[k] !== b.draft.settings[k])
		.map((k) => ({ label: SETTING_LABEL[k], from: settingText(k, a.draft.settings[k]), to: settingText(k, b.draft.settings[k]) }));

	const notes = (['assumptions', 'exclusions', 'risks'] as const).map((k) => {
		const [la, lb] = [lineSet(a.draft[k]), lineSet(b.draft[k])];
		return { kind: k, added: lb.filter((l) => !la.includes(l)), removed: la.filter((l) => !lb.includes(l)) };
	});

	return { a: { version: a.version, ...totals(a) }, b: { version: b.version, ...totals(b) }, added, removed, changed, team, rates, settings, notes };
}

export type VersionDiff = ReturnType<typeof diffVersions>;
