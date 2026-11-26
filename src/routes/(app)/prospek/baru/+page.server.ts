import { fail, redirect } from '@sveltejs/kit';
import * as v from 'valibot';
import { db } from '#lib/server/db/index.ts';
import { formOf } from '#lib/server/form.ts';
import { createProspect, listClients } from '#lib/server/prospects.ts';
import { fieldErrors } from '#lib/validation/master.ts';
import { ProspectSchema } from '#lib/validation/prospect.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ clients: listClients(db) });

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await formOf(request);
		const r = v.safeParse(ProspectSchema, form);
		if (!r.success) return fail(400, { values: form, errors: fieldErrors(r.issues) });
		redirect(303, `/prospek/${createProspect(db, r.output)}`);
	}
};
