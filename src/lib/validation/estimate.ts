// Isi estimasi yang dapat diedit (F4–F6). Dikirim utuh dari editor setiap simpan otomatis.
// Effort selalu dalam jam; satuan SP hanya tampilan.
import * as v from 'valibot';
import { isOrdered } from '../calc/pert.ts';
import { SettingsNumbersSchema } from './master.ts';

export const MAX_FEATURES = 200;

const text = (max: number) => v.pipe(v.string(), v.maxLength(max, `Maksimal ${max} karakter.`));
const hours = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(100_000));
const roleId = v.pipe(v.number(), v.integer(), v.minValue(1));

const ThreePointSchema = v.pipe(
	v.object({ o: hours, m: hours, p: hours }),
	v.check(isOrdered, 'Nilai optimis ≤ paling mungkin ≤ pesimis.')
);

export const DraftFeatureSchema = v.object({
	module: text(80),
	name: text(160),
	description: text(2000),
	priority: v.picklist(['must', 'should', 'could']),
	assumptions: text(2000),
	/** Hasil draf AI yang belum ditinjau PM (PRD F4). */
	aiDraft: v.optional(v.boolean()),
	efforts: v.pipe(
		v.record(v.pipe(v.string(), v.regex(/^\d+$/)), ThreePointSchema),
		v.transform((r) => Object.fromEntries(Object.entries(r).map(([k, t]) => [Number(k), t])) as Record<number, v.InferOutput<typeof ThreePointSchema>>)
	)
});

export const EstimateDraftSchema = v.object({
	settings: SettingsNumbersSchema,
	assumptions: text(5000),
	exclusions: text(5000),
	risks: text(5000),
	/** Rencana tanggal mulai; null = tanpa kalender. */
	plannedStart: v.nullable(
		v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/), v.check((d) => !Number.isNaN(Date.parse(d)), 'Tanggal mulai tidak valid.'))
	),
	features: v.pipe(v.array(DraftFeatureSchema), v.maxLength(MAX_FEATURES, `Maksimal ${MAX_FEATURES} fitur per estimasi.`)),
	team: v.array(
		v.object({
			roleId,
			mp: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(100)),
			months: v.nullable(v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(120)))
		})
	),
	overhead: v.pipe(
		v.array(v.object({ label: text(120), amount: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1e13)) })),
		v.maxLength(50)
	)
});

export type EstimateDraft = v.InferOutput<typeof EstimateDraftSchema>;
export type DraftFeature = EstimateDraft['features'][number];
