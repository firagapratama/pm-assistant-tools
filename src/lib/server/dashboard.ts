// Dashboard utama: angka dan agregat untuk grafik (pipeline prospek, kesehatan proyek, beban peran, RAID, tenggat).
import { and, eq, gte, lte, ne } from 'drizzle-orm';
import { addDays } from '../calc/calendar.ts';
import { computeDraft } from '../estimate.ts';
import { PROSPECT_STATUSES, type ProspectStatus } from '../labels.ts';
import { raidScore, severity } from '../raid.ts';
import type { Db } from './db/index.ts';
import { projectActivities, projects, prospects, raidItems, statusHistory } from './db/schema.ts';
import { getEstimate, listEstimates } from './estimates.ts';
import { projectDashboard } from './projects.ts';
import { listProspects } from './prospects.ts';

/** Harga jual (skenario paling mungkin) dari versi final, atau versi terbaru bila belum ada yang final. */
function prospectValue(db: Db, prospectId: number): number {
	const versions = listEstimates(db, prospectId);
	const pick = versions.find((v) => v.isFinal) ?? versions[0];
	if (!pick) return 0;
	const e = getEstimate(db, prospectId, pick.version)!;
	return computeDraft(e.draft, e.rates, e.holidays).likely.cost.price;
}

const month = (d: Date) => d.toISOString().slice(0, 7);

export function dashboardData(db: Db, today: string) {
	const allProspects = listProspects(db);
	const valued = allProspects.map((p) => ({ ...p, value: prospectValue(db, p.id) }));
	const pipeline = PROSPECT_STATUSES.map((status: ProspectStatus) => {
		const rows = valued.filter((p) => p.status === status);
		return { status, count: rows.length, value: rows.reduce((a, p) => a + p.value, 0) };
	});
	const open = valued.filter((p) => p.status !== 'deal' && p.status !== 'batal');

	// Prospek masuk per bulan, 6 bulan terakhir (termasuk bulan berjalan).
	const months = Array.from({ length: 6 }, (_, i) => {
		const d = new Date(today + 'T00:00:00Z');
		d.setUTCDate(1);
		d.setUTCMonth(d.getUTCMonth() - (5 - i));
		return month(d);
	});
	const deals = db.select({ at: statusHistory.createdAt }).from(statusHistory).where(eq(statusHistory.to, 'deal')).all();
	const intake = months.map((m) => ({
		month: m,
		count: allProspects.filter((p) => month(p.createdAt) === m).length,
		deals: deals.filter((d) => month(d.at) === m).length
	}));

	const decided = pipeline.find((s) => s.status === 'deal')!.count + pipeline.find((s) => s.status === 'batal')!.count;
	const winRate = decided ? (pipeline.find((s) => s.status === 'deal')!.count / decided) * 100 : null;

	const cards = projectDashboard(db, today);
	const active = cards.filter((p) => p.status === 'aktif');

	// Kebutuhan orang per peran di proyek aktif (dari tim baseline).
	const activeRows = db.select({ id: projects.id, baseline: projects.baseline }).from(projects).where(eq(projects.status, 'aktif')).all();
	const roleMap = new Map<string, number>();
	for (const p of activeRows) for (const t of p.baseline.team ?? []) roleMap.set(t.name, (roleMap.get(t.name) ?? 0) + t.mp);
	const roles = [...roleMap].map(([name, mp]) => ({ name, mp })).sort((a, b) => b.mp - a.mp);

	// RAID terbuka di proyek aktif, per jenis; risiko dipisah tinggi vs lainnya.
	const raid = db
		.select({ type: raidItems.type, impact: raidItems.impact, likelihood: raidItems.likelihood, status: raidItems.status })
		.from(raidItems)
		.innerJoin(projects, eq(projects.id, raidItems.projectId))
		.where(and(eq(projects.status, 'aktif'), ne(raidItems.status, 'selesai')))
		.all();
	const raidByType = (['risk', 'issue', 'dependency', 'assumption'] as const).map((type) => {
		const rows = raid.filter((r) => r.type === type);
		return { type, count: rows.length, high: rows.filter((r) => severity(raidScore(r)) === 'tinggi').length };
	});

	// Aktivitas/milestone belum selesai yang jatuh tempo dalam 14 hari (termasuk yang sudah lewat).
	const horizon = addDays(today, 14);
	const due = db
		.select({
			projectId: projects.id,
			project: prospects.name,
			name: projectActivities.name,
			kind: projectActivities.kind,
			endDate: projectActivities.endDate
		})
		.from(projectActivities)
		.innerJoin(projects, eq(projects.id, projectActivities.projectId))
		.innerJoin(prospects, eq(prospects.id, projects.prospectId))
		.where(and(eq(projects.status, 'aktif'), eq(projectActivities.done, false), lte(projectActivities.endDate, horizon), gte(projectActivities.endDate, addDays(today, -30))))
		.orderBy(projectActivities.endDate)
		.all();

	return {
		today,
		kpi: {
			activeProjects: active.length,
			openPipelineValue: open.reduce((a, p) => a + p.value, 0),
			openPipelineCount: open.length,
			winRate,
			decided,
			highRisks: active.reduce((a, p) => a + p.highRisks, 0)
		},
		health: (['merah', 'kuning', 'hijau'] as const).map((h) => ({ health: h, count: active.filter((p) => p.health === h).length })),
		progress: active.map((p) => ({ id: p.id, name: p.name, overall: p.overall, expected: p.expected, health: p.health, started: p.startDate <= today, startDate: p.startDate })),
		pipeline,
		intake,
		roles,
		raidByType,
		due
	};
}

export type DashboardData = ReturnType<typeof dashboardData>;
