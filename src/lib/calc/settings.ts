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
	/** Cadangan cuti tahunan per orang (hari kerja per tahun); mengurangi kapasitas. */
	leaveDaysPerYear: number;
	/** Cadangan sakit per orang (hari kerja per tahun); mengurangi kapasitas. */
	sickDaysPerYear: number;
	/** Rencana lembur per orang per sprint (jam); menambah kapasitas dan biaya. */
	overtimeHoursPerSprint: number;
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
	rangeSigma: 1,
	leaveDaysPerYear: 12,
	sickDaysPerYear: 3,
	overtimeHoursPerSprint: 0
};

/**
 * Snapshot parameter estimasi lama dibuat sebelum ada cuti/sakit/lembur; nilainya 0 agar angka
 * estimasi final dan baseline proyek tidak berubah diam-diam.
 */
export const withAvailabilityDefaults = (s: EstimateSettings): EstimateSettings => ({
	...s,
	leaveDaysPerYear: s.leaveDaysPerYear ?? 0,
	sickDaysPerYear: s.sickDaysPerYear ?? 0,
	overtimeHoursPerSprint: s.overtimeHoursPerSprint ?? 0
});
