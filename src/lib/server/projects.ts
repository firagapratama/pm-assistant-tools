// Konversi prospek menjadi proyek (PRD F9): estimasi final menjadi baseline yang dibekukan.
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { WorkCalendar, addDays } from '../calc/calendar.ts';
import { pertE } from '../calc/pert.ts';
import { planFeatures } from '../calc/schedule.ts';
import { lines } from '../format/index.ts';
import { calendarFor, computeDraft } from '../estimate.ts';
import { roleLabel } from '../labels.ts';
import { maxPlanSprint, type ProjectBaseline } from '../project.ts';
import { HEALTHS, projectStatus, statusInputFrom, type Health } from '../project-status.ts';
import type { Db, DbLike } from './db/index.ts';
import type { Priority } from '../calc/index.ts';
import { crImpact, crLabel, type ThreePointMap } from '../change-request.ts';
import {
	changeRequests,
	estimateEfforts,
	estimateFeatures,
	estimates,
	projectActivities,
	projectFeatures,
	projects,
	prospects,
	raidItems,
	sprints
} from './db/schema.ts';
import { listDecisions } from './decisions.ts';
import { getEstimate, mainScenarioId } from './estimates.ts';
import { StatusChangeError, checkStatusChange, writeStatus } from './prospects.ts';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Status Deal: membuat proyek dari versi estimasi final dalam satu transaksi.
 * Rencana sprint dibuat dari tanggal mulai dan kalender libur estimasi; asumsi dan risiko masuk RAID log.
 */
export function dealProspect(db: Db, prospectId: number, startDate: string, note = ''): number {
	if (!ISO_DATE.test(startDate) || Number.isNaN(Date.parse(startDate)))
		throw new StatusChangeError('Isi tanggal mulai proyek.');
	const from = checkStatusChange(db, prospectId, 'deal');

	const finalRow = db
		.select({ version: estimates.version })
		.from(estimates)
		.where(and(eq(estimates.prospectId, prospectId), eq(estimates.isFinal, true)))
		.get()!;
	const estimate = getEstimate(db, prospectId, finalRow.version)!;
	const draft = { ...estimate.draft, plannedStart: startDate };
	const result = computeDraft(draft, estimate.rates, estimate.holidays);
	const calendar = calendarFor(draft, estimate.holidays)!;
	const { sprint, cost } = result.likely;
	const roleName = (id: number) => {
		const r = estimate.rates.find((x) => x.roleId === id);
		return r ? roleLabel(r) : `Peran #${id}`;
	};

	const baseline: ProjectBaseline = {
		estimateVersion: estimate.version,
		devSprints: sprint.devSprints,
		totalSprints: sprint.totalSprints,
		sprintsLow: result.low.sprint.totalSprints,
		sprintsHigh: result.high.sprint.totalSprints,
		weeks: sprint.weeks,
		months: sprint.months,
		endDate: calendar.endDate(sprint.totalSprints),
		effortHours: result.totalEffort.e,
		sigmaHours: result.totalEffort.sigma,
		labor: cost.labor,
		overhead: cost.overhead,
		subtotal: cost.subtotal,
		contingency: cost.contingency,
		total: cost.total,
		price: cost.price,
		priceLow: result.low.cost.price,
		priceHigh: result.high.cost.price,
		margin: cost.margin,
		tmTotal: cost.tmTotal,
		tmMonthlyRate: cost.tmMonthlyRate,
		team: cost.roles
			.filter((r) => r.mp > 0)
			.map((r) => ({ roleId: r.roleId, name: roleName(r.roleId), mp: r.mp, months: r.months, rate: r.rate, amount: r.amount }))
	};

	return db.transaction((tx) => {
		writeStatus(tx, prospectId, from, 'deal', { note: note || `Proyek dibuat dari estimasi v${estimate.version}` });
		const { id } = tx
			.insert(projects)
			.values({
				prospectId,
				baselineEstimateId: estimate.id,
				baselineScenarioId: mainScenarioId(tx, estimate.id),
				startDate,
				baseline
			})
			.returning({ id: projects.id })
			.get();

		const windows = calendar.schedule(sprint.totalSprints);
		if (windows.length)
			tx.insert(sprints)
				.values(
					windows.map((w) => ({
						projectId: id,
						number: w.number,
						startDate: w.from,
						endDate: w.to,
						plan: w.number > sprint.devSprints ? 'Stabilisasi/UAT' : 'Pengembangan'
					}))
				)
				.run();

		const raid = [
			...lines(estimate.draft.assumptions).map((d) => ({ type: 'assumption' as const, description: d })),
			...lines(estimate.draft.risks).map((d) => ({ type: 'risk' as const, description: d }))
		];
		if (raid.length) tx.insert(raidItems).values(raid.map((r) => ({ ...r, projectId: id }))).run();
		ensureSchedule(tx, id);
		ensureActivities(tx, id);
		return id;
	});
}

export function listProjects(db: Db) {
	return db
		.select({
			id: projects.id,
			name: prospects.name,
			client: prospects.client,
			startDate: projects.startDate,
			status: projects.status,
			baseline: projects.baseline
		})
		.from(projects)
		.innerJoin(prospects, eq(prospects.id, projects.prospectId))
		.orderBy(desc(projects.startDate), desc(projects.id))
		.all();
}

export function getProject(db: Db, id: number) {
	const project = db.select().from(projects).where(eq(projects.id, id)).get();
	if (!project) return null;
	ensureSchedule(db, id); // proyek lama dibuat sebelum ada Gantt
	ensureActivities(db, id);
	const prospect = db.select().from(prospects).where(eq(prospects.id, project.prospectId)).get()!;
	const estimateRow = db.select({ version: estimates.version }).from(estimates).where(eq(estimates.id, project.baselineEstimateId)).get()!;
	const estimate = getEstimate(db, prospect.id, estimateRow.version)!;
	const crs = db.select().from(changeRequests).where(eq(changeRequests.projectId, id)).orderBy(desc(changeRequests.number)).all();
	const ctx = { draft: estimate.draft, rates: estimate.rates, holidays: estimate.holidays, startDate: project.startDate };
	const approvedEfforts = crs.filter((c) => c.status === 'disetujui').toReversed().map((c) => c.efforts);
	return {
		project,
		prospect,
		estimate,
		sprints: db.select().from(sprints).where(eq(sprints.projectId, id)).orderBy(asc(sprints.number)).all(),
		raid: db.select().from(raidItems).where(eq(raidItems.projectId, id)).orderBy(asc(raidItems.id)).all(),
		schedule: getSchedule(db, id),
		activities: listActivities(db, id),
		decisions: listDecisions(db, id),
		/** `effect`: dampak yang dibekukan bila sudah diputuskan, atau perkiraan saat ini bila masih diajukan. */
		changeRequests: crs.map((c) => ({ ...c, effect: c.impact ?? crImpact(ctx, approvedEfforts, c.efforts) }))
	};
}

const HEALTH_ORDER: Record<Health, number> = { merah: 0, kuning: 1, hijau: 2 };

/** Dashboard kesehatan (F10): ringkasan per proyek, proyek aktif yang paling bermasalah lebih dulu. */
export function projectDashboard(db: Db, today: string) {
	return listProjects(db)
		.map(({ id }) => {
			const p = getProject(db, id)!;
			const st = projectStatus(statusInputFrom(p, today));
			return {
				id,
				name: p.prospect.name,
				client: p.prospect.client,
				status: p.project.status,
				startDate: p.project.startDate,
				health: st.health,
				autoHealth: st.autoHealth,
				manual: st.override !== null,
				reasons: st.reasons,
				overall: st.overall,
				expected: st.expected,
				currentSprint: st.currentSprint,
				totalSprints: p.project.baseline.totalSprints + st.scope.sprints,
				plannedEnd: st.plannedEnd,
				slipDays: st.slipDays,
				highRisks: st.highRisks.length,
				blockers: st.blockers.length,
				late: st.late.length,
				pendingCr: st.pendingCr,
				scopePct: st.scope.effortPct,
				nextDue: st.nextDue && { name: st.nextDue.name, kind: st.nextDue.kind, date: st.nextDue.endDate }
			};
		})
		.sort((a, b) => Number(a.status !== 'aktif') - Number(b.status !== 'aktif') || HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health]);
}

/** Status kesehatan manual (F10): wajib beralasan; `null` mengembalikan ke otomatis. */
export function setHealthOverride(db: Db, projectId: number, value: { health: Health; reason: string } | null) {
	if (value) {
		if (!HEALTHS.includes(value.health)) throw new ScheduleError('Status tidak dikenal.');
		value = { ...value, reason: value.reason.trim() };
		if (!value.reason) throw new ScheduleError('Tulis alasan mengganti status.');
		if (value.reason.length > 500) throw new ScheduleError('Alasan maksimal 500 karakter.');
	}
	const res = db
		.update(projects)
		.set({ healthOverride: value?.health ?? null, healthReason: value?.reason ?? null })
		.where(eq(projects.id, projectId))
		.run();
	if (!res.changes) throw new ScheduleError('Proyek tidak ada.');
}

/** Proyek milik prospek (untuk tautan dua arah dari halaman prospek). */
export function projectIdForProspect(db: Db, prospectId: number): number | null {
	return db.select({ id: projects.id }).from(projects).where(eq(projects.prospectId, prospectId)).get()?.id ?? null;
}

/** Tanggal mulai proyek bila estimasi ini adalah baseline-nya. */
export function baselineStartFor(db: Db, estimateId: number): string | null {
	return db.select({ start: projects.startDate }).from(projects).where(eq(projects.baselineEstimateId, estimateId)).get()?.start ?? null;
}

// ── Jadwal fitur (Gantt) ───────────────────────────────────────

export class ScheduleError extends Error {}

/** Fitur baseline beserta effort per peran, urut seperti di estimasi. */
function baselineFeatures(db: DbLike, estimateId: number) {
	const features = db
		.select()
		.from(estimateFeatures)
		.where(eq(estimateFeatures.estimateId, estimateId))
		.orderBy(asc(estimateFeatures.sortOrder), asc(estimateFeatures.id))
		.all();
	const efforts = features.length
		? db.select().from(estimateEfforts).where(inArray(estimateEfforts.featureId, features.map((f) => f.id))).all()
		: [];
	return features.map((f) => ({
		...f,
		efforts: Object.fromEntries(efforts.filter((e) => e.featureId === f.id).map((e) => [e.roleId, { o: e.o, m: e.m, p: e.p }]))
	}));
}

/** Membuat jadwal awal (= baseline) bila proyek belum punya. */
export function ensureSchedule(db: DbLike, projectId: number) {
	const exists = db.select({ id: projectFeatures.featureId }).from(projectFeatures).where(eq(projectFeatures.projectId, projectId)).get();
	if (exists) return;
	const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
	if (!project) return;
	const estimate = db.select().from(estimates).where(eq(estimates.id, project.baselineEstimateId)).get()!;
	const features = baselineFeatures(db, estimate.id);
	if (!features.length) return;
	const calendar = new WorkCalendar(project.startDate, estimate.settings, estimate.holidays);
	const team = project.baseline.team.map((t) => ({ roleId: t.roleId, mp: t.mp, months: null }));
	const plan = planFeatures(features, team, estimate.settings, calendar.factor);
	db.insert(projectFeatures)
		.values(
			features.map((f) => {
				const span = plan.get(f.id)!;
				return { projectId, featureId: f.id, baselineStart: span.start, baselineEnd: span.end, planStart: span.start, planEnd: span.end };
			})
		)
		.run();
}

/** Baris jadwal: fitur baseline (urut estimasi), lalu change request yang disetujui (urut nomor). */
export function getSchedule(db: Db, projectId: number) {
	const project = db.select({ estimateId: projects.baselineEstimateId }).from(projects).where(eq(projects.id, projectId)).get();
	if (!project) return [];
	const rows = db.select().from(projectFeatures).where(eq(projectFeatures.projectId, projectId)).all();
	const row = (r: (typeof rows)[number], f: { module: string; name: string; priority: Priority; efforts: ThreePointMap }) => ({
		/** Kunci baris jadwal: `f<fiturId>` atau `c<crId>`. */
		key: r.changeRequestId ? `c${r.changeRequestId}` : `f${r.featureId}`,
		featureId: r.featureId,
		changeRequestId: r.changeRequestId,
		module: f.module,
		name: f.name,
		priority: f.priority,
		effortHours: Object.values(f.efforts).reduce((a, t) => a + pertE(t), 0),
		baselineStart: r.baselineStart,
		baselineEnd: r.baselineEnd,
		planStart: r.planStart,
		planEnd: r.planEnd,
		progress: r.progress,
		updatedAt: r.updatedAt
	});
	const baseline = baselineFeatures(db, project.estimateId).flatMap((f) => {
		const r = rows.find((x) => x.featureId === f.id);
		return r ? [row(r, f)] : [];
	});
	const crs = db
		.select()
		.from(changeRequests)
		.where(and(eq(changeRequests.projectId, projectId), eq(changeRequests.status, 'disetujui')))
		.orderBy(asc(changeRequests.number))
		.all()
		.flatMap((c) => {
			const r = rows.find((x) => x.changeRequestId === c.id);
			return r ? [row(r, { module: 'Change request', name: `${crLabel(c.number)} ${c.title}`, priority: 'must', efforts: c.efforts })] : [];
		});
	return [...baseline, ...crs];
}

export type ScheduleRow = ReturnType<typeof getSchedule>[number];


/** Baris jadwal dari kuncinya (`f<fiturId>` / `c<crId>`). */
function scheduleRow(key: string) {
	const m = /^([fc])([1-9]\d*)$/.exec(key);
	if (!m) throw new ScheduleError('Baris jadwal tidak dikenal.');
	return m[1] === 'f' ? eq(projectFeatures.featureId, Number(m[2])) : eq(projectFeatures.changeRequestId, Number(m[2]));
}

export function updateFeatureSchedule(
	db: Db,
	projectId: number,
	key: string,
	change: { planStart: number; planEnd: number; progress: number }
) {
	const project = db.select({ baseline: projects.baseline }).from(projects).where(eq(projects.id, projectId)).get();
	if (!project) throw new ScheduleError('Proyek tidak ditemukan.');
	const max = maxPlanSprint(project.baseline.totalSprints);
	const { planStart, planEnd, progress } = change;
	if (![planStart, planEnd, progress].every(Number.isInteger)) throw new ScheduleError('Sprint dan progres harus bilangan bulat.');
	if (planStart < 1 || planEnd > max) throw new ScheduleError(`Sprint harus antara 1 dan ${max}.`);
	if (planStart > planEnd) throw new ScheduleError('Sprint mulai tidak boleh setelah sprint selesai.');
	if (progress < 0 || progress > 100) throw new ScheduleError('Progres harus 0–100%.');
	const res = db
		.update(projectFeatures)
		.set({ planStart, planEnd, progress, updatedAt: new Date() })
		.where(and(eq(projectFeatures.projectId, projectId), scheduleRow(key)))
		.run();
	if (res.changes === 0) throw new ScheduleError('Fitur tidak ada di proyek ini.');
}

/** Mengembalikan rencana semua fitur ke baseline; progres tidak diubah. */
export function resetSchedule(db: Db, projectId: number) {
	const rows = db.select().from(projectFeatures).where(eq(projectFeatures.projectId, projectId)).all();
	db.transaction((tx) => {
		for (const r of rows)
			tx.update(projectFeatures)
				.set({ planStart: r.baselineStart, planEnd: r.baselineEnd })
				.where(and(eq(projectFeatures.projectId, projectId), r.changeRequestId ? eq(projectFeatures.changeRequestId, r.changeRequestId) : eq(projectFeatures.featureId, r.featureId!)))
				.run();
	});
}

// ── Aktivitas & milestone ──────────────────────────────────────

export type ActivityKind = 'aktivitas' | 'milestone';
export interface ActivityInput {
	name: string;
	kind: ActivityKind;
	startDate: string;
	endDate: string;
	done: boolean;
}

/**
 * Templat awal: Kick-off, Sprint 1..N (pengembangan), SIT dan UAT di sprint stabilisasi, Go-live.
 * Satu sprint stabilisasi dibagi dua (paruh pertama SIT, paruh kedua UAT); bila lebih dari satu,
 * sprint stabilisasi pertama untuk SIT dan sisanya UAT.
 */
export function activityTemplate(calendar: WorkCalendar, devSprints: number, totalSprints: number, goLive: string) {
	// Aktivitas berakhir di hari kerja terakhir, bukan Minggu penutup jendela sprint.
	const span = (name: string, from: string, to: string): Omit<ActivityInput, 'done'> => ({
		name,
		kind: 'aktivitas',
		startDate: from,
		endDate: calendar.workdayOnOrBefore(to) < from ? from : calendar.workdayOnOrBefore(to)
	});
	const windows = calendar.schedule(totalSprints);
	const acts: Omit<ActivityInput, 'done'>[] = [
		{ name: 'Kick-off proyek', kind: 'milestone', startDate: calendar.start, endDate: calendar.start }
	];
	for (const w of windows.slice(0, devSprints)) acts.push(span(`Sprint ${w.number}`, w.from, w.to));
	const stab = windows.slice(devSprints);
	if (stab.length === 1) {
		const w = stab[0];
		const half = Math.floor((Date.parse(w.to) - Date.parse(w.from)) / 86_400_000 / 2) + 1;
		acts.push(span('SIT', w.from, addDays(w.from, half - 1)));
		acts.push(span('UAT', addDays(w.from, half), w.to));
	} else if (stab.length > 1) {
		acts.push(span('SIT', stab[0].from, stab[0].to));
		acts.push(span('UAT', stab[1].from, stab.at(-1)!.to));
	}
	acts.push({ name: 'Go-live', kind: 'milestone', startDate: goLive, endDate: goLive });
	return acts;
}

/** Membuat aktivitas dari templat bila proyek belum punya. */
export function ensureActivities(db: DbLike, projectId: number) {
	if (db.select({ id: projectActivities.id }).from(projectActivities).where(eq(projectActivities.projectId, projectId)).get()) return;
	const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
	if (!project) return;
	const estimate = db.select().from(estimates).where(eq(estimates.id, project.baselineEstimateId)).get()!;
	const calendar = new WorkCalendar(project.startDate, estimate.settings, estimate.holidays);
	const b = project.baseline;
	const acts = activityTemplate(calendar, b.devSprints, b.totalSprints, b.endDate);
	db.insert(projectActivities)
		.values(acts.map((a, i) => ({ ...a, projectId, sortOrder: i })))
		.run();
}

export function listActivities(db: Db, projectId: number) {
	return db
		.select()
		.from(projectActivities)
		.where(eq(projectActivities.projectId, projectId))
		.orderBy(asc(projectActivities.startDate), asc(projectActivities.sortOrder), asc(projectActivities.id))
		.all();
}

export type ActivityRow = ReturnType<typeof listActivities>[number];

function checkActivity(db: Db, projectId: number, input: ActivityInput): ActivityInput {
	const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
	if (!project) throw new ScheduleError('Proyek tidak ditemukan.');
	const name = input.name.trim();
	if (!name) throw new ScheduleError('Nama aktivitas belum diisi.');
	if (name.length > 120) throw new ScheduleError('Nama aktivitas maksimal 120 karakter.');
	if (input.kind !== 'aktivitas' && input.kind !== 'milestone') throw new ScheduleError('Jenis aktivitas tidak dikenal.');
	const valid = (d: string) => ISO_DATE.test(d) && !Number.isNaN(Date.parse(d));
	if (!valid(input.startDate)) throw new ScheduleError('Tanggal mulai tidak valid.');
	const endDate = input.kind === 'milestone' ? input.startDate : input.endDate;
	if (!valid(endDate)) throw new ScheduleError('Tanggal selesai tidak valid.');
	if (endDate < input.startDate) throw new ScheduleError('Tanggal selesai tidak boleh sebelum tanggal mulai.');
	if (input.startDate < project.startDate) throw new ScheduleError('Aktivitas tidak boleh dimulai sebelum proyek dimulai.');
	const estimate = db.select({ settings: estimates.settings }).from(estimates).where(eq(estimates.id, project.baselineEstimateId)).get()!;
	const limit = addDays(project.startDate, maxPlanSprint(project.baseline.totalSprints) * estimate.settings.sprintWeeks * 7 - 1);
	if (endDate > limit) throw new ScheduleError('Aktivitas terlalu jauh dari jadwal proyek.');
	return { name, kind: input.kind, startDate: input.startDate, endDate, done: input.done };
}

/** Membuat (id null) atau mengubah aktivitas. */
export function saveActivity(db: Db, projectId: number, id: number | null, input: ActivityInput): number {
	const clean = checkActivity(db, projectId, input);
	if (id === null) {
		const last = db.select({ n: projectActivities.sortOrder }).from(projectActivities).where(eq(projectActivities.projectId, projectId)).orderBy(desc(projectActivities.sortOrder)).get();
		return db.insert(projectActivities).values({ ...clean, projectId, sortOrder: (last?.n ?? -1) + 1 }).returning({ id: projectActivities.id }).get().id;
	}
	const res = db.update(projectActivities).set(clean).where(and(eq(projectActivities.id, id), eq(projectActivities.projectId, projectId))).run();
	if (res.changes === 0) throw new ScheduleError('Aktivitas tidak ada di proyek ini.');
	return id;
}

export function deleteActivity(db: Db, projectId: number, id: number) {
	db.delete(projectActivities).where(and(eq(projectActivities.id, id), eq(projectActivities.projectId, projectId))).run();
}
