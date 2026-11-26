/** Parameter estimasi (PRD F1). Persentase dalam basis poin: 1% = 100. */
export interface EstimateSettings {
	inputUnit: 'sp' | 'jam';
	/** Story point per jam (default 2 → 1 SP = 0,5 jam). */
	spPerHour: number;
	sprintWeeks: number;
	workDaysPerSprint: number;
	effectiveHoursPerDay: number;
	focusFactor: number;
	stabilizationSprints: number;
	contingencyBp: number;
	markupBp: number;
	weeksPerMonth: number;
	/** Lebar rentang untuk direksi dalam kelipatan σ (PRD 7.4). */
	rangeSigma: number;
}

export const DEFAULT_SETTINGS: EstimateSettings = {
	inputUnit: 'sp',
	spPerHour: 2,
	sprintWeeks: 2,
	workDaysPerSprint: 10,
	effectiveHoursPerDay: 6,
	focusFactor: 0.8,
	stabilizationSprints: 1,
	contingencyBp: 1500,
	markupBp: 3000,
	weeksPerMonth: 4,
	rangeSigma: 1
};
