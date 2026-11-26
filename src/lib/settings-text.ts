// Parameter estimasi sebagai teks form (koma desimal, persen), untuk Pengaturan dan editor estimasi.
import type { EstimateSettings } from './calc/settings.ts';
import { decimal } from './format/index.ts';

export type SettingsText = Record<Exclude<keyof EstimateSettings, 'inputUnit'>, string> & {
	inputUnit: EstimateSettings['inputUnit'];
};

export const settingsToText = (s: EstimateSettings): SettingsText => ({
	inputUnit: s.inputUnit,
	spPerHour: decimal(s.spPerHour, 4),
	sprintWeeks: String(s.sprintWeeks),
	workDaysPerSprint: decimal(s.workDaysPerSprint, 4),
	effectiveHoursPerDay: decimal(s.effectiveHoursPerDay, 4),
	focusFactor: decimal(s.focusFactor, 4),
	stabilizationSprints: String(s.stabilizationSprints),
	contingencyBp: decimal(s.contingencyBp / 100, 2),
	markupBp: decimal(s.markupBp / 100, 2),
	weeksPerMonth: decimal(s.weeksPerMonth, 4),
	rangeSigma: decimal(s.rangeSigma, 2)
});
