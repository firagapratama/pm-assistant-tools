import { fail } from '@sveltejs/kit';
import * as v from 'valibot';
import { db } from '#lib/server/db/index.ts';
import { formOf } from '#lib/server/form.ts';
import { OFFICIAL_HOLIDAYS } from '#lib/server/holidays-id.ts';
import { deleteHoliday, listHolidays, loadOfficialHolidays, setHoliday } from '#lib/server/master.ts';
import { HolidaySchema, fieldErrors } from '#lib/validation/master.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const holidays = listHolidays(db);
	const have = new Set(holidays.map((h) => h.date));
	// Tahun resmi yang belum lengkap di kalender (ada tanggal SKB yang belum tercatat).
	const missingOfficial = Object.entries(OFFICIAL_HOLIDAYS)
		.filter(([, list]) => list.some((h) => !have.has(h.date)))
		.map(([year]) => Number(year));
	return { holidays, missingOfficial, officialYears: Object.keys(OFFICIAL_HOLIDAYS).map(Number) };
};

export const actions: Actions = {
	save: async ({ request }) => {
		const form = await formOf(request);
		const r = v.safeParse(HolidaySchema, form);
		if (!r.success) return fail(400, { action: 'save', values: form, errors: fieldErrors(r.issues) });
		setHoliday(db, r.output);
		return { message: 'Libur tersimpan' };
	},

	delete: async ({ request }) => {
		const { date } = await formOf(request);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return fail(400, { action: 'delete', errors: { _: 'Tanggal tidak valid.' } });
		deleteHoliday(db, date);
		return { message: 'Libur dihapus' };
	},

	loadOfficial: () => {
		const added = loadOfficialHolidays(db);
		return { message: added ? `${added} tanggal resmi ditambahkan` : 'Kalender sudah lengkap' };
	}
};
