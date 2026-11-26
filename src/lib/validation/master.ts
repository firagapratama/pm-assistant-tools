// Validasi input Pengaturan (F1). Input form selalu string; skema ini mengubahnya ke tipe data.
import * as v from 'valibot';
import type { EstimateSettings } from '../calc/settings.ts';
import { parseNumber } from '../format/index.ts';
import { LEVELS, SOURCES } from '../labels.ts';

interface RangeOpts {
	int?: boolean;
	exclusiveMin?: boolean;
	/** Satuan di pesan error, misalnya "%". */
	unit?: string;
	/** Pembagi untuk menampilkan batas di pesan (basis poin → persen = 100). */
	scale?: number;
}

const rangeMessage = (label: string, min: number, max: number, o: RangeOpts) => {
	const f = (x: number) => String(x / (o.scale ?? 1)).replace('.', ',') + (o.unit ?? '');
	return o.exclusiveMin
		? `${label} harus lebih dari ${f(min)} dan maksimal ${f(max)}.`
		: `${label} harus antara ${f(min)}–${f(max)}.`;
};

/** Angka dalam rentang [min, max]. */
const between = (label: string, min: number, max: number, o: RangeOpts = {}) =>
	v.pipe(
		v.number(`${label} harus berupa angka.`),
		v.check((n) => Number.isFinite(n), `${label} harus berupa angka.`),
		v.check((n) => !o.int || Number.isInteger(n), `${label} harus bilangan bulat.`),
		v.check((n) => (o.exclusiveMin ? n > min : n >= min) && n <= max, rangeMessage(label, min, max, o))
	);

/** Teks angka format Indonesia ("0,8", "15.000.000") menjadi number. */
const textNumber = (label: string) =>
	v.pipe(
		v.string(),
		v.transform(parseNumber),
		v.check((n) => !Number.isNaN(n), `${label} harus berupa angka.`)
	);

/** Angka format Indonesia dalam rentang [min, max]. */
const num = (label: string, min: number, max: number, o: RangeOpts = {}) =>
	v.pipe(textNumber(label), between(label, min, max, o));

const isoDate = v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal berlaku belum diisi.'));

const optionalLevel = v.pipe(
	v.optional(v.string(), ''),
	v.transform((s) => (s === '' ? null : s)),
	v.nullable(v.picklist(LEVELS, 'Level tidak dikenal.'))
);

export const RoleSchema = v.object({
	name: v.pipe(v.string(), v.trim(), v.minLength(1, 'Nama peran belum diisi.'), v.maxLength(60, 'Nama peran maksimal 60 karakter.')),
	level: optionalLevel,
	source: v.picklist(SOURCES, 'Sumber tidak dikenal.')
});

export const RateSchema = v.object({
	monthlyRate: num('Rate bulanan', 0, 10_000_000_000, { int: true }),
	effectiveFrom: isoDate
});

/** Rate opsional saat menambah peran: kosong = belum ada rate. */
export const NewRoleSchema = v.object({
	...RoleSchema.entries,
	monthlyRate: v.pipe(
		v.optional(v.string(), ''),
		v.transform((s) => (s.trim() === '' ? null : parseNumber(s))),
		v.check((n) => n === null || (Number.isInteger(n) && n >= 0), 'Rate bulanan harus angka rupiah bulat.')
	),
	effectiveFrom: isoDate
});

const settingsFields = {
	inputUnit: v.picklist(['sp', 'jam'], 'Satuan tidak dikenal.'),
	spPerHour: between('Story point per jam', 0, 100, { exclusiveMin: true }),
	sprintWeeks: between('Panjang sprint', 1, 8, { int: true }),
	workDaysPerSprint: between('Hari kerja per sprint', 0, 40, { exclusiveMin: true }),
	effectiveHoursPerDay: between('Jam efektif per hari', 0, 24, { exclusiveMin: true }),
	focusFactor: between('Focus factor', 0, 1, { exclusiveMin: true }),
	stabilizationSprints: between('Sprint stabilisasi', 0, 10, { int: true }),
	contingencyBp: between('Contingency', 0, 10_000, { int: true, unit: '%', scale: 100 }),
	markupBp: between('Markup', 0, 50_000, { int: true, unit: '%', scale: 100 }),
	weeksPerMonth: between('Minggu per bulan', 0, 5, { exclusiveMin: true }),
	rangeSigma: between('Lebar rentang', 0, 3, { exclusiveMin: true })
};

const workDaysFitSprint = v.check(
	(s: EstimateSettings) => s.workDaysPerSprint <= s.sprintWeeks * 7,
	'Hari kerja per sprint melebihi jumlah hari dalam sprint.'
);

/** Parameter estimasi sebagai angka: untuk parameter per estimasi. */
export const SettingsNumbersSchema = v.pipe(v.object(settingsFields), workDaysFitSprint) satisfies v.GenericSchema<
	unknown,
	EstimateSettings
>;

const fromText = <T extends v.GenericSchema<number, number>>(field: T, transform = (n: number) => n) =>
	v.pipe(v.string(), v.transform((s) => transform(parseNumber(s))), field);
const pctToBp = (pct: number) => Math.round(pct * 100);

/** Form Pengaturan: setiap field teks diubah ke angka lalu divalidasi dengan aturan yang sama. */
export const SettingsSchema = v.pipe(
	v.object({
		inputUnit: settingsFields.inputUnit,
		spPerHour: fromText(settingsFields.spPerHour),
		sprintWeeks: fromText(settingsFields.sprintWeeks),
		workDaysPerSprint: fromText(settingsFields.workDaysPerSprint),
		effectiveHoursPerDay: fromText(settingsFields.effectiveHoursPerDay),
		focusFactor: fromText(settingsFields.focusFactor),
		stabilizationSprints: fromText(settingsFields.stabilizationSprints),
		contingencyBp: fromText(settingsFields.contingencyBp, pctToBp),
		markupBp: fromText(settingsFields.markupBp, pctToBp),
		weeksPerMonth: fromText(settingsFields.weeksPerMonth),
		rangeSigma: fromText(settingsFields.rangeSigma)
	}),
	workDaysFitSprint
);

/** Pesan error per field dari hasil safeParse. */
export function fieldErrors(issues: [v.BaseIssue<unknown>, ...v.BaseIssue<unknown>[]]): Record<string, string> {
	const flat = v.flatten(issues);
	const out: Record<string, string> = {};
	for (const [k, msgs] of Object.entries(flat.nested ?? {})) if (msgs?.[0]) out[k] = msgs[0];
	if (flat.root?.[0]) out._ = flat.root[0];
	return out;
}

export const HolidaySchema = v.object({
	date: v.pipe(
		v.string(),
		v.regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal belum diisi.'),
		v.check((d) => !Number.isNaN(Date.parse(d)), 'Tanggal tidak valid.')
	),
	name: v.pipe(v.string(), v.trim(), v.minLength(1, 'Nama libur belum diisi.'), v.maxLength(120, 'Maksimal 120 karakter.')),
	type: v.picklist(['nasional', 'cuti_bersama'], 'Pilih jenis libur.')
});
