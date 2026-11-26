// Change request (PRD F13): dampak effort/sprint/biaya dihitung dengan mesin estimasi yang sama (F4–F6).
import type { Holiday } from './calc/calendar.ts';
import type { ThreePoint } from './calc/pert.ts';
import { computeDraft, type RateSnapshot } from './estimate.ts';
import type { ProjectBaseline } from './project.ts';
import type { DraftFeature, EstimateDraft } from './validation/estimate.ts';

export const CR_STATUSES = ['diajukan', 'disetujui', 'ditolak'] as const;
export type CrStatus = (typeof CR_STATUSES)[number];
export const CR_STATUS_LABEL: Record<CrStatus, string> = { diajukan: 'Diajukan', disetujui: 'Disetujui', ditolak: 'Ditolak' };

/** Effort per peran (jam), kunci = roleId. */
export type ThreePointMap = Record<number, ThreePoint>;

/** Selisih terhadap rencana sebelum CR ini (baseline + CR yang sudah disetujui). */
export interface CrImpact {
	effortHours: number;
	sprints: number;
	/** Biaya (sebelum markup) dan harga jual, rupiah. */
	cost: number;
	price: number;
}

export interface CrContext {
	draft: EstimateDraft;
	rates: RateSnapshot[];
	holidays: Holiday[];
	startDate: string;
}

export const crLabel = (n: number) => `CR-${n}`;

const asFeature = (efforts: ThreePointMap, name = ''): DraftFeature => ({
	module: 'Change request',
	name,
	description: '',
	priority: 'must',
	assumptions: '',
	efforts
});

function plan(ctx: CrContext, extra: ThreePointMap[]) {
	const r = computeDraft({ ...ctx.draft, plannedStart: ctx.startDate, features: [...ctx.draft.features, ...extra.map((e) => asFeature(e))] }, ctx.rates, ctx.holidays);
	return { effort: r.totalEffort.e, sprints: r.likely.sprint.totalSprints, cost: r.likely.cost.total, price: r.likely.cost.price };
}

/** Dampak menambahkan `efforts` di atas baseline + CR yang sudah disetujui. */
export function crImpact(ctx: CrContext, approved: ThreePointMap[], efforts: ThreePointMap): CrImpact {
	const before = plan(ctx, approved);
	const after = plan(ctx, [...approved, efforts]);
	return {
		effortHours: after.effort - before.effort,
		sprints: after.sprints - before.sprints,
		cost: after.cost - before.cost,
		price: after.price - before.price
	};
}

/** Akumulasi perubahan scope dari CR yang disetujui, relatif terhadap baseline. */
export function scopeChange(baseline: ProjectBaseline, approved: CrImpact[]) {
	const sum = (k: keyof CrImpact) => approved.reduce((a, i) => a + i[k], 0);
	const effortHours = sum('effortHours');
	return {
		count: approved.length,
		effortHours,
		effortPct: baseline.effortHours > 0 ? (effortHours / baseline.effortHours) * 100 : 0,
		sprints: sum('sprints'),
		price: sum('price')
	};
}
