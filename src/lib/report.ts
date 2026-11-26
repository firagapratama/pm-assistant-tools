// Laporan status mingguan (PRD F14): data otomatis dari jadwal dan RAID, dibekukan saat dikirim.
import { addDays } from './calc/calendar.ts';
import { crLabel, type CrStatus } from './change-request.ts';
import { projectStatus, type Health, type StatusInput } from './project-status.ts';
import { RAID_TYPE_LABEL, raidScore, reviewOverdue, severity, isOpen, type RaidType } from './raid.ts';

/** Senin–Minggu dari minggu yang memuat `iso`. */
export function weekOf(iso: string): { start: string; end: string } {
	const day = new Date(iso + 'T00:00:00Z').getUTCDay(); // 0 = Minggu
	const start = addDays(iso, -((day + 6) % 7));
	return { start, end: addDays(start, 6) };
}

export interface ReportData {
	generatedOn: string;
	period: { start: string; end: string };
	health: Health;
	reasons: string[];
	progress: { overall: number; expected: number };
	features: { done: number; inProgress: number; notStarted: number; total: number };
	plannedEnd: string;
	baselineEnd: string;
	slipDays: number;
	/** Aktivitas/milestone yang jatuh tempo di periode ini atau minggu depan. */
	upcoming: { name: string; kind: 'aktivitas' | 'milestone'; startDate: string; endDate: string; done: boolean }[];
	late: { kind: 'fitur' | 'aktivitas'; name: string; endDate: string }[];
	/** Rincian progres fitur (template Teknis). */
	featureList: { module: string; name: string; progress: number; endDate: string; late: boolean }[];
	/** RAID terbuka, skor tertinggi lebih dulu. */
	openRaid: {
		type: RaidType;
		typeLabel: string;
		description: string;
		owner: string;
		score: number | null;
		severity: 'tinggi' | 'sedang' | 'rendah' | null;
		mitigation: string;
		reviewOverdue: boolean;
	}[];
	newRaidThisWeek: number;
	/** CR yang menunggu keputusan, diajukan, atau diputuskan di periode ini (laporan lama: tidak ada). */
	changeRequests?: { label: string; title: string; status: CrStatus; effortHours: number; sprints: number; price: number; decisionDate: string | null }[];
	/** Akumulasi perubahan scope yang disetujui sejak baseline. */
	scope?: { count: number; effortPct: number; sprints: number; price: number };
}

export function buildReport(input: StatusInput, period: { start: string; end: string }): ReportData {
	const s = projectStatus(input);
	const nextWeekEnd = addDays(period.end, 7);
	const isoIn = (iso: string) => iso >= period.start && iso <= period.end;
	const inPeriod = (d: Date) => isoIn(d.toISOString().slice(0, 10));
	return {
		generatedOn: input.today,
		period,
		health: s.health,
		reasons: s.reasons,
		progress: { overall: s.overall, expected: s.expected },
		features: {
			done: s.features.filter((f) => f.progress >= 100).length,
			inProgress: s.features.filter((f) => f.progress > 0 && f.progress < 100).length,
			notStarted: s.features.filter((f) => f.progress === 0).length,
			total: s.features.length
		},
		plannedEnd: s.plannedEnd,
		baselineEnd: input.baseline.endDate,
		slipDays: s.slipDays,
		upcoming: s.activities
			.filter((a) => a.endDate >= period.start && a.startDate <= nextWeekEnd)
			.map(({ name, kind, startDate, endDate, done }) => ({ name, kind, startDate, endDate, done })),
		late: s.late,
		featureList: s.features.map((f) => ({ module: f.module, name: f.name, progress: f.progress, endDate: f.endDate, late: f.flag === 'terlambat' })),
		openRaid: input.raid
			.filter(isOpen)
			.map((r) => {
				const score = raidScore(r);
				return {
					type: r.type,
					typeLabel: RAID_TYPE_LABEL[r.type],
					description: r.description,
					owner: r.owner,
					score,
					severity: severity(score),
					mitigation: r.mitigation,
					reviewOverdue: reviewOverdue(r, input.today)
				};
			})
			.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
		newRaidThisWeek: input.raid.filter((r) => inPeriod(r.createdAt)).length,
		changeRequests: (input.changeRequests ?? [])
			.filter((c) => c.status === 'diajukan' || isoIn(c.requestDate) || (c.decisionDate !== null && isoIn(c.decisionDate)))
			.toSorted((a, b) => a.number - b.number)
			.map((c) => ({
				label: crLabel(c.number),
				title: c.title,
				status: c.status,
				effortHours: c.effect.effortHours,
				sprints: c.effect.sprints,
				price: c.effect.price,
				decisionDate: c.decisionDate
			})),
		scope: { count: s.scope.count, effortPct: s.scope.effortPct, sprints: s.scope.sprints, price: s.scope.price }
	};
}
