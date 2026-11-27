import { describe, expect, it } from 'vitest';
import {
	DEFAULT_SETTINGS as BASE_SETTINGS,
	aggregateEffort,
	applyBp,
	computeScenario,
	fromHours,
	hoursPerPersonPerSprint,
	isOrdered,
	pertE,
	pertSigma,
	spToHours,
	sprintPlan,
	planFeatures,
	sprintsNeeded,
	suggestTeam,
	toHours,
	WorkCalendar,
	type FeatureEffortInput
} from './index';
import { costPlan, overtimePayFactor } from './cost';
import { withAvailabilityDefaults } from './settings';

// Contoh PRD 7.6 tanpa cadangan cuti/sakit; cadangan diuji terpisah.
const DEFAULT_SETTINGS = { ...BASE_SETTINGS, leaveDaysPerYear: 0, sickDaysPerYear: 0 };

const BE = 1, FE = 2, QA = 3, UX = 4, PM = 5;
const exact = (h: number) => ({ o: h, m: h, p: h });

describe('PRD 7.6 contoh perhitungan lengkap', () => {
	const features: FeatureEffortInput[] = [
		{
			priority: 'must',
			efforts: {
				[BE]: exact(spToHours(960, 2)),
				[FE]: exact(360),
				[QA]: exact(200),
				[UX]: exact(120)
			}
		}
	];
	const result = computeScenario({
		features,
		team: [
			{ roleId: BE, mp: 2, months: null },
			{ roleId: FE, mp: 2, months: null },
			{ roleId: QA, mp: 1, months: null },
			{ roleId: UX, mp: 1, months: 1.5 },
			{ roleId: PM, mp: 0.5, months: null }
		],
		rates: new Map([
			[BE, 15_000_000],
			[FE, 13_000_000],
			[QA, 10_000_000],
			[UX, 12_000_000],
			[PM, 18_000_000]
		]),
		overhead: [],
		settings: DEFAULT_SETTINGS
	});
	const { sprint, cost } = result.likely;

	it('kapasitas 48 jam per orang per sprint', () => {
		expect(hoursPerPersonPerSprint(DEFAULT_SETTINGS)).toBe(48);
	});

	it('sprint per peran dan bottleneck Backend', () => {
		const byRole = new Map(sprint.roles.map((r) => [r.roleId, r.sprints]));
		expect(byRole.get(BE)).toBe(5);
		expect(byRole.get(FE)).toBe(3.75);
		expect(byRole.get(QA)).toBeCloseTo(4.1667, 4);
		expect(byRole.get(UX)).toBe(2.5);
		expect(sprint.bottleneckRoleId).toBe(BE);
	});

	it('6 sprint = 12 minggu = 3 bulan', () => {
		expect(sprint.devSprints).toBe(5);
		expect(sprint.totalSprints).toBe(6);
		expect(sprint.weeks).toBe(12);
		expect(sprint.months).toBe(3);
	});

	it('biaya per peran', () => {
		expect(cost.roles.map((r) => [r.roleId, r.amount])).toEqual([
			[BE, 90_000_000],
			[FE, 78_000_000],
			[QA, 30_000_000],
			[UX, 18_000_000],
			[PM, 27_000_000]
		]);
	});

	it('subtotal, contingency, total biaya, harga jual, margin', () => {
		expect(cost.subtotal).toBe(243_000_000);
		expect(cost.contingency).toBe(36_450_000);
		expect(cost.total).toBe(279_450_000);
		expect(cost.price).toBe(363_285_000);
		expect(cost.margin).toBeCloseTo(0.2308, 4);
	});

	it('sudut pandang time & material: tanpa contingency', () => {
		expect(cost.tmTotal).toBe(315_900_000); // 243 jt × 1,3
		expect(cost.tmMonthlyRate).toBe(113_100_000); // (30 + 26 + 10 + 12 + 9) jt × 1,3
	});

	it('tanpa ketidakpastian, rentang bawah = atas = paling mungkin', () => {
		expect(result.optimistic.sprint.totalSprints).toBe(6);
		expect(result.pessimistic.cost.price).toBe(363_285_000);
		expect(result.low.cost.price).toBe(363_285_000);
		expect(result.high.cost.price).toBe(363_285_000);
	});
});

describe('PERT', () => {
	it('E dan σ', () => {
		expect(pertE({ o: 4, m: 6, p: 14 })).toBe(7);
		expect(pertSigma({ o: 4, m: 6, p: 14 })).toBeCloseTo(10 / 6);
	});

	it('validasi O ≤ M ≤ P', () => {
		expect(isOrdered({ o: 1, m: 2, p: 3 })).toBe(true);
		expect(isOrdered({ o: 2, m: 2, p: 2 })).toBe(true);
		expect(isOrdered({ o: 3, m: 2, p: 4 })).toBe(false);
		expect(isOrdered({ o: 1, m: 5, p: 4 })).toBe(false);
		expect(isOrdered({ o: -1, m: 0, p: 1 })).toBe(false);
		expect(isOrdered({ o: NaN, m: 0, p: 1 })).toBe(false);
	});

	it('σ total per peran = √Σσ², filter prioritas, faktor kalibrasi', () => {
		const features: FeatureEffortInput[] = [
			{ priority: 'must', efforts: { [BE]: { o: 0, m: 6, p: 18 } } }, // σ 3
			{ priority: 'could', efforts: { [BE]: { o: 0, m: 8, p: 24 } } } // σ 4
		];
		expect(aggregateEffort(features).get(BE)!.sigma).toBeCloseTo(5);
		expect(aggregateEffort(features, { priorities: ['must'] }).get(BE)!.e).toBe(7);
		expect(
			aggregateEffort(features, { priorities: ['must'], calibration: new Map([[BE, 1.2]]) }).get(BE)!.e
		).toBeCloseTo(8.4);
	});
});

describe('satuan', () => {
	it('SP ↔ jam bolak-balik tanpa kehilangan nilai', () => {
		for (const sp of [0, 1, 3, 13, 960, 0.5]) {
			expect(fromHours(toHours(sp, 'sp', 2), 'sp', 2)).toBe(sp);
		}
		expect(toHours(12, 'jam', 2)).toBe(12);
	});
});

describe('sprint', () => {
	it('peran dengan effort tetapi MP 0 diberi peringatan, bukan Infinity', () => {
		const plan = sprintPlan(new Map([[BE, 96], [QA, 48]]), [{ roleId: BE, mp: 1, months: null }], DEFAULT_SETTINGS);
		expect(plan.unstaffedRoleIds).toEqual([QA]);
		expect(plan.devSprints).toBe(2);
	});

	it('pembulatan ke atas tahan galat floating point', () => {
		const plan = sprintPlan(new Map([[BE, 0.1 * 3 * 480]]), [{ roleId: BE, mp: 0.3, months: null }], DEFAULT_SETTINGS);
		expect(plan.devSprints).toBe(10);
	});
});

describe('uang', () => {
	it('basis poin dibulatkan setengah ke atas', () => {
		expect(applyBp(243_000_000, 1500)).toBe(36_450_000);
		expect(applyBp(1, 5000)).toBe(1); // 0,5 → 1
		expect(applyBp(1, 4999)).toBe(0);
		expect(applyBp(999_999_999_999, 3000)).toBe(300_000_000_000); // tetap tepat di angka besar
	});
});

describe('kalender kerja', () => {
	const holidays = [
		{ date: '2027-03-08', name: 'Nyepi', type: 'nasional' as const },
		{ date: '2027-03-09', name: 'Idulfitri', type: 'cuti_bersama' as const },
		{ date: '2027-03-10', name: 'Idulfitri', type: 'nasional' as const },
		{ date: '2027-03-11', name: 'Idulfitri', type: 'nasional' as const },
		{ date: '2027-03-12', name: 'Idulfitri', type: 'cuti_bersama' as const },
		{ date: '2027-03-15', name: 'Idulfitri', type: 'cuti_bersama' as const },
		{ date: '2027-03-25', name: 'Wafat Yesus Kristus', type: 'cuti_bersama' as const },
		{ date: '2027-03-26', name: 'Wafat Yesus Kristus', type: 'nasional' as const },
		{ date: '2027-03-28', name: 'Paskah (Minggu)', type: 'nasional' as const }
	];
	const cal = new WorkCalendar('2027-03-08', DEFAULT_SETTINGS, holidays);

	it('sprint dikurangi libur hari kerja; libur akhir pekan tidak dihitung', () => {
		expect(cal.sprint(0)).toMatchObject({ from: '2027-03-08', to: '2027-03-21', workingDays: 4 });
		expect(cal.sprint(1)).toMatchObject({ from: '2027-03-22', to: '2027-04-04', workingDays: 8 });
		expect(cal.sprint(1).holidays.map((h) => h.date)).toEqual(['2027-03-25', '2027-03-26']);
		expect(cal.factor(0)).toBe(0.4);
		expect(cal.factor(5)).toBe(1);
	});

	it('effort yang sama butuh lebih banyak sprint saat ada libur', () => {
		// 96 jam, kapasitas normal 96 jam/sprint: tanpa libur 1 sprint; dengan Lebaran 0,4 + 0,75 sprint.
		expect(sprintsNeeded(96, 96)).toBe(1);
		expect(sprintsNeeded(96, 96, cal.factor)).toBeCloseTo(1.75, 10);
		const plan = sprintPlan(new Map([[BE, 96]]), [{ roleId: BE, mp: 2, months: null }], DEFAULT_SETTINGS, cal.factor);
		expect(plan.devSprints).toBe(2);
		expect(plan.totalSprints).toBe(3);
	});

	it('jumlah sprint yang muat sebelum tenggat', () => {
		expect(cal.sprintsUntil('2027-03-18')).toBe(0);
		expect(cal.sprintsUntil('2027-03-19')).toBe(1);
		expect(cal.sprintsUntil('2027-04-29')).toBe(3); // sprint 4 berakhir Jumat 30 Apr
		expect(cal.sprintsUntil('2027-04-30')).toBe(4);
	});

	it('tanggal selesai = hari kerja terakhir sprint terakhir', () => {
		expect(cal.endDate(1)).toBe('2027-03-19'); // Minggu 21 Mar → mundur ke Jumat 19 Mar
		const friHoliday = new WorkCalendar('2027-03-15', DEFAULT_SETTINGS, holidays);
		expect(friHoliday.endDate(1)).toBe('2027-03-24'); // 26 Mar libur, 25 Mar cuti bersama → Rabu 24 Mar
	});
});

describe('saran tim', () => {
	const effort = new Map([[BE, 480], [FE, 360], [QA, 200], [PM, 0]]);

	it('PRD 7.6 dengan target 5 sprint pengembangan: BE 2, FE 1,5, QA 1', () => {
		const team = suggestTeam(effort, DEFAULT_SETTINGS, 5);
		expect(Object.fromEntries(team)).toEqual({ [BE]: 2, [FE]: 1.5, [QA]: 1 });
		const plan = sprintPlan(effort, [...team].map(([roleId, mp]) => ({ roleId, mp, months: null })), DEFAULT_SETTINGS);
		expect(plan.devSprints).toBeLessThanOrEqual(5);
	});

	it('target lebih cepat butuh lebih banyak orang; saran selalu memenuhi target', () => {
		const team = suggestTeam(effort, DEFAULT_SETTINGS, 3);
		expect(team.get(BE)).toBe(3.5); // 480 / (48 × 3) = 3,33 → 3,5
		const plan = sprintPlan(effort, [...team].map(([roleId, mp]) => ({ roleId, mp, months: null })), DEFAULT_SETTINGS);
		expect(plan.devSprints).toBeLessThanOrEqual(3);
	});

	it('memperhitungkan libur: target 2 sprint mulai Lebaran 2027', () => {
		const cal = new WorkCalendar('2027-03-08', DEFAULT_SETTINGS, [
			...['2027-03-08', '2027-03-09', '2027-03-10', '2027-03-11', '2027-03-12', '2027-03-15', '2027-03-25', '2027-03-26'].map(
				(date) => ({ date, name: 'Libur', type: 'nasional' as const })
			)
		]);
		// Kapasitas 2 sprint = 0,4 + 0,8 = 1,2 porsi → BE 480 / (48 × 1,2) = 8,33 → 8,5
		const team = suggestTeam(new Map([[BE, 480]]), DEFAULT_SETTINGS, 2, cal.factor);
		expect(team.get(BE)).toBe(8.5);
		const plan = sprintPlan(new Map([[BE, 480]]), [{ roleId: BE, mp: 8.5, months: null }], DEFAULT_SETTINGS, cal.factor);
		expect(plan.devSprints).toBe(2);
	});
});

describe('jadwal fitur (Gantt)', () => {
	const ex = (h: number) => ({ o: h, m: h, p: h });
	const team = [
		{ roleId: BE, mp: 2, months: null },
		{ roleId: FE, mp: 1, months: null }
	];

	it('satu peran: fitur berurutan memenuhi kapasitas 96 jam/sprint', () => {
		const plan = planFeatures(
			[
				{ id: 1, efforts: { [BE]: ex(96) } }, // posisi 0–1
				{ id: 2, efforts: { [BE]: ex(48) } }, // 1–1,5
				{ id: 3, efforts: { [BE]: ex(144) } } // 1,5–3
			],
			team,
			DEFAULT_SETTINGS
		);
		expect(Object.fromEntries(plan)).toEqual({ 1: { start: 1, end: 1 }, 2: { start: 2, end: 2 }, 3: { start: 2, end: 3 } });
	});

	it('peran berbeda bekerja paralel; fitur selesai saat peran terakhir selesai', () => {
		const plan = planFeatures(
			[
				{ id: 1, efforts: { [BE]: ex(96), [FE]: ex(48) } }, // BE 0–1, FE 0–1
				{ id: 2, efforts: { [FE]: ex(96) } } // FE 1–3: tidak menunggu BE
			],
			team,
			DEFAULT_SETTINGS
		);
		expect(Object.fromEntries(plan)).toEqual({ 1: { start: 1, end: 1 }, 2: { start: 2, end: 3 } });
	});

	it('libur memperlambat: sprint pertama hanya 40% kapasitas', () => {
		const factor = (i: number) => (i === 0 ? 0.4 : 1);
		const plan = planFeatures([{ id: 1, efforts: { [BE]: ex(96) } }, { id: 2, efforts: { [BE]: ex(96) } }], team, DEFAULT_SETTINGS, factor);
		// 96 jam: 38,4 di sprint 1 + 57,6 di sprint 2 → fitur 1 sprint 1–2; fitur 2 lanjut sampai sprint 3
		expect(Object.fromEntries(plan)).toEqual({ 1: { start: 1, end: 2 }, 2: { start: 2, end: 3 } });
	});

	it('jadwal sejalan dengan jumlah sprint pengembangan', () => {
		const features = [80, 120, 60, 160, 40].map((h, i) => ({ id: i + 1, priority: 'must' as const, efforts: { [BE]: ex(h), [FE]: ex(h / 2) } }));
		const plan = planFeatures(features, team, DEFAULT_SETTINGS);
		const dev = sprintPlan(new Map([[BE, 460], [FE, 230]]), team, DEFAULT_SETTINGS).devSprints;
		expect(Math.max(...[...plan.values()].map((s) => s.end))).toBe(dev);
	});
});

describe('ketersediaan tim: cuti, sakit, lembur', () => {
	it('cadangan cuti + sakit mengurangi kapasitas, lembur menambah', () => {
		const s = { ...DEFAULT_SETTINGS, leaveDaysPerYear: 12, sickDaysPerYear: 12 }; // 24/240 = 10%
		expect(hoursPerPersonPerSprint(s)).toBeCloseTo(48 * 0.9, 6);
		expect(hoursPerPersonPerSprint({ ...DEFAULT_SETTINGS, overtimeHoursPerSprint: 10 })).toBeCloseTo(48 + 10 * 0.8, 6);
		// Snapshot lama tanpa field baru: tetap 48 jam (angka lama tidak berubah).
		const legacy = { ...DEFAULT_SETTINGS } as Partial<typeof DEFAULT_SETTINGS>;
		delete legacy.leaveDaysPerYear;
		delete legacy.sickDaysPerYear;
		delete legacy.overtimeHoursPerSprint;
		expect(hoursPerPersonPerSprint(legacy as typeof DEFAULT_SETTINGS)).toBe(48);
		expect(withAvailabilityDefaults(legacy as typeof DEFAULT_SETTINGS)).toMatchObject({ leaveDaysPerYear: 0, sickDaysPerYear: 0, overtimeHoursPerSprint: 0 });
	});

	it('upah lembur: jam pertama ×1,5, berikutnya ×2 (PP 35/2021)', () => {
		expect(overtimePayFactor(10, 10)).toBe(1.5); // 1 jam/hari
		expect(overtimePayFactor(20, 10)).toBe(1.75); // 2 jam/hari: (1,5 + 2) / 2
		expect(overtimePayFactor(0, 10)).toBe(0);
		const plan = costPlan([{ roleId: BE, mp: 1, months: null }], new Map([[BE, 17_300_000]]), 1, [], { ...DEFAULT_SETTINGS, overtimeHoursPerSprint: 10 }, 2);
		// 1 orang × 10 jam × 2 sprint × (17,3 jt / 173) × 1,5 = 3 jt
		expect(plan.overtime).toBe(3_000_000);
		expect(plan.subtotal).toBe(plan.labor + 3_000_000);
	});
});

describe('dampak ketersediaan tim di proyek', () => {
	it('cuti memundurkan, lembur memajukan, peran tanpa fitur diabaikan', async () => {
		const { availabilityImpact } = await import('../availability.ts');
		const cal = new WorkCalendar('2027-03-01', DEFAULT_SETTINGS, [{ date: '2027-03-03', name: 'Nyepi', type: 'nasional' }]);
		expect(cal.workdaysBetween('2027-03-01', '2027-03-07')).toBe(4); // Sen–Min, Rabu libur
		expect(cal.addWorkdays('2027-03-02', 2)).toBe('2027-03-05');
		expect(cal.addWorkdays('2027-03-05', -2)).toBe('2027-03-02');
		const team = [{ roleId: 1, name: 'Backend', mp: 2, months: null }, { roleId: 9, name: 'PM', mp: 1, months: null }];
		const delivery = new Set([1]);
		// 1 Backend cuti 4 hari kerja, tim Backend 2 orang → mundur 2 hari; cuti PM tidak dihitung.
		const leave = availabilityImpact(
			[
				{ roleId: 1, kind: 'cuti', people: 1, startDate: '2027-03-01', endDate: '2027-03-05', hours: 0 },
				{ roleId: 9, kind: 'sakit', people: 1, startDate: '2027-03-01', endDate: '2027-03-12', hours: 0 }
			],
			team, delivery, DEFAULT_SETTINGS, cal
		);
		expect(leave).toMatchObject({ shiftDays: 2, byRole: [{ roleId: 1, lostDays: 4, delayDays: 2 }] });
		// Lembur 2 orang × 3 jam × 4 hari = 24 jam = 2 hari kapasitas tim (2 × 6 jam) → maju 2 hari.
		const ot = availabilityImpact([{ roleId: 1, kind: 'lembur', people: 2, startDate: '2027-03-01', endDate: '2027-03-05', hours: 3 }], team, delivery, DEFAULT_SETTINGS, cal);
		expect(ot.shiftDays).toBe(-2);
	});
});
