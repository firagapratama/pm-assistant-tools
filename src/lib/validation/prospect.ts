import * as v from 'valibot';
import { parseNumber } from '../format/index.ts';
import { PROSPECT_STATUSES } from '../labels.ts';

const text = (max: number) => v.pipe(v.optional(v.string(), ''), v.trim(), v.maxLength(max, `Maksimal ${max} karakter.`));

const optionalDate = v.pipe(
	v.optional(v.string(), ''),
	v.transform((s) => (s === '' ? null : s)),
	v.nullable(v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal tidak valid.')))
);

const optionalRupiah = v.pipe(
	v.optional(v.string(), ''),
	v.transform((s) => (s.trim() === '' ? null : parseNumber(s))),
	v.check((n) => n === null || (Number.isInteger(n) && n >= 0), 'Batas anggaran harus angka rupiah bulat.')
);

export const ProspectSchema = v.object({
	name: v.pipe(v.string(), v.trim(), v.minLength(1, 'Nama prospek belum diisi.'), v.maxLength(120, 'Maksimal 120 karakter.')),
	client: text(120),
	contact: text(200),
	needs: text(5000),
	businessGoal: text(2000),
	deadline: optionalDate,
	budget: optionalRupiah,
	notes: text(5000)
});
export type ProspectInput = v.InferOutput<typeof ProspectSchema>;

export const StatusChangeSchema = v.object({
	to: v.picklist(PROSPECT_STATUSES, 'Pilih status baru.'),
	note: text(2000),
	cancelReason: text(2000),
	/** Wajib untuk Deal: tanggal mulai proyek (F9). */
	startDate: v.optional(v.string(), '')
});

export const ProspectFilterSchema = v.object({
	q: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(120)), ''),
	status: v.optional(v.picklist(['', ...PROSPECT_STATUSES]), ''),
	client: v.optional(v.pipe(v.string(), v.maxLength(120)), '')
});

/** Nilai form (string) dari data prospek tersimpan. */
export function toFormValues(p: {
	name: string;
	client: string;
	contact: string;
	needs: string;
	businessGoal: string;
	deadline: string | null;
	budget: number | null;
	notes: string;
}): Record<string, string> {
	return {
		name: p.name,
		client: p.client,
		contact: p.contact,
		needs: p.needs,
		businessGoal: p.businessGoal,
		deadline: p.deadline ?? '',
		budget: p.budget === null ? '' : new Intl.NumberFormat('id-ID').format(p.budget),
		notes: p.notes
	};
}
