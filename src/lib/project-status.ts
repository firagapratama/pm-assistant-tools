// Status proyek berjalan: dipakai halaman proyek dan laporan mingguan (F14), satu sumber perhitungan.
import { WorkCalendar, type Holiday } from './calc/calendar.ts';
import type { EstimateSettings } from './calc/settings.ts';
import { weightedProgress, type ProjectBaseline } from './project.ts';
import { isHighRisk, isOpen, reviewOverdue, type RaidLike } from './raid.ts';

export type Health = 'hijau' | 'kuning' | 'merah';
export const HEALTHS = ['hijau', 'kuning', 'merah'] as const;
export const HEALTH_LABEL: Record<Health, string> = { hijau: 'Hijau', kuning: 'Kuning', merah: 'Merah' };
/** Kelas badge status umum (aman/waspada/kritis) untuk tiap tingkat kesehatan. */
export const HEALTH_BADGE: Record<Health, string> = { hijau: 'aman', kuning: 'waspada', merah: 'kritis' };
/** Isu terbuka lebih dari ini (hari) dianggap blocker yang membuat status Kuning (F10). */
export const BLOCKER_DAYS = 2;

export interface StatusInput {
	startDate: string;
	baseline: ProjectBaseline;
	settings: EstimateSettings;
	holidays: Holiday[];
	schedule: { featureId: number; module: string; name: string; effortHours: number; planStart: number; planEnd: number; progress: number }[];
	activities: { id: number; name: string; kind: 'aktivitas' | 'milestone'; startDate: string; endDate: string; done: boolean }[];
	raid: (RaidLike & { id: number; description: string; owner: string; createdAt: Date })[];
	/** Status yang ditetapkan PM; menggantikan status otomatis. */
	override?: { health: Health; reason: string } | null;
	today: string;
}

const DAY = 86_400_000;
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

export function projectStatus(input: StatusInput) {
	const { startDate, baseline: b, today } = input;
	const calendar = new WorkCalendar(startDate, input.settings, input.holidays);
	const sprintFrom = (n: number) => calendar.sprint(n - 1).from;
	const sprintTo = (n: number) => calendar.sprint(n - 1).to;

	const features = input.schedule.map((r) => {
		const late = r.progress < 100 && today > sprintTo(r.planEnd);
		const notStarted = !late && r.progress === 0 && today >= sprintFrom(r.planStart);
		return {
			...r,
			startDate: sprintFrom(r.planStart),
			endDate: calendar.endDate(r.planEnd),
			flag: late ? ('terlambat' as const) : notStarted ? ('belum-mulai' as const) : null
		};
	});
	const activities = input.activities.map((a) => ({ ...a, flag: !a.done && today > a.endDate ? ('terlambat' as const) : null }));

	const overall = weightedProgress(input.schedule);
	/** Progres yang seharusnya tercapai hari ini (linear per fitur, ditimbang effort). */
	const expected = weightedProgress(
		input.schedule.map((r) => {
			const from = Date.parse(sprintFrom(r.planStart));
			const to = Date.parse(sprintTo(r.planEnd)) + DAY;
			return { effortHours: r.effortHours, progress: Math.min(100, Math.max(0, ((Date.parse(today) - from) / (to - from)) * 100)) };
		})
	);
	const plannedEnd =
		[...input.activities.map((a) => a.endDate), calendar.endDate(Math.max(0, ...input.schedule.map((r) => r.planEnd)))].sort().at(-1) ??
		b.endDate;
	const slipDays = days(b.endDate, plannedEnd);
	const durationDays = Math.max(1, days(startDate, b.endDate));
	const slipPct = (slipDays / durationDays) * 100;

	const late = [
		...features.filter((f) => f.flag === 'terlambat').map((f) => ({ kind: 'fitur' as const, name: f.name, endDate: f.endDate })),
		...activities.filter((a) => a.flag).map((a) => ({ kind: 'aktivitas' as const, name: a.name, endDate: a.endDate }))
	];
	const highRisks = input.raid.filter(isHighRisk);
	const unmitigated = highRisks.filter((r) => !r.mitigation.trim());
	const overdueReviews = input.raid.filter((r) => reviewOverdue(r, today));
	const behind = today >= startDate ? expected - overall : 0;
	// Blocker = isu yang belum selesai (F10: Kuning bila terbuka > 2 hari).
	const blockers = input.raid.filter((r) => r.type === 'issue' && isOpen(r));
	const staleBlockers = blockers.filter((r) => days(r.createdAt.toISOString().slice(0, 10), today) > BLOCKER_DAYS);
	const nextDue = activities.filter((a) => !a.done && a.endDate >= today).sort((a, b) => a.endDate.localeCompare(b.endDate))[0] ?? null;
	let currentSprint = 0;
	while (currentSprint < b.totalSprints && today >= sprintFrom(currentSprint + 1)) currentSprint++;

	// Kesehatan (diadaptasi dari PRD F10; biaya belum dilacak sehingga hanya jadwal dan risiko).
	const red: string[] = [];
	const yellow: string[] = [];
	if (slipPct > 20) red.push(`Proyeksi selesai mundur ${slipDays} hari (${Math.round(slipPct)}% dari durasi baseline)`);
	else if (slipPct >= 10) yellow.push(`Proyeksi selesai mundur ${slipDays} hari (${Math.round(slipPct)}% dari durasi baseline)`);
	if (unmitigated.length) red.push(`${unmitigated.length} risiko tinggi belum punya mitigasi`);
	if (late.length) yellow.push(`${late.length} fitur/aktivitas terlambat`);
	if (behind > 15) yellow.push(`Progres ${Math.round(behind)} poin di bawah rencana`);
	if (staleBlockers.length) yellow.push(`${staleBlockers.length} blocker terbuka lebih dari ${BLOCKER_DAYS} hari`);
	const autoHealth: Health = red.length ? 'merah' : yellow.length ? 'kuning' : 'hijau';
	const override = input.override ?? null;
	const autoReasons = [...red, ...yellow];

	return {
		calendar,
		features,
		activities,
		overall,
		expected,
		plannedEnd,
		slipDays,
		late,
		highRisks,
		overdueReviews,
		blockers,
		nextDue,
		currentSprint,
		autoHealth,
		override,
		health: override?.health ?? autoHealth,
		/** Alasan otomatis; bila ditetapkan manual, alasan PM ditaruh paling depan. */
		reasons: override ? [`Ditetapkan PM: ${override.reason}`, ...autoReasons] : autoReasons
	};
}

export type ProjectStatus = ReturnType<typeof projectStatus>;

/** Masukan status dari data halaman proyek (`getProject`). */
export function statusInputFrom(
	p: {
		project: { startDate: string; baseline: ProjectBaseline; healthOverride: Health | null; healthReason: string | null };
		estimate: { draft: { settings: EstimateSettings }; holidays: Holiday[] };
		schedule: StatusInput['schedule'];
		activities: StatusInput['activities'];
		raid: StatusInput['raid'];
	},
	today: string
): StatusInput {
	return {
		startDate: p.project.startDate,
		baseline: p.project.baseline,
		settings: p.estimate.draft.settings,
		holidays: p.estimate.holidays,
		schedule: p.schedule,
		activities: p.activities,
		raid: p.raid,
		override: p.project.healthOverride ? { health: p.project.healthOverride, reason: p.project.healthReason ?? '' } : null,
		today
	};
}
