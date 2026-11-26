import { error, fail, redirect } from '@sveltejs/kit';
import * as v from 'valibot';
import { db } from '#lib/server/db/index.ts';
import { EstimateError, createEstimate, deleteEstimate, getEstimate, listEstimates } from '#lib/server/estimates.ts';
import { dealProspect, projectIdForProspect } from '#lib/server/projects.ts';
import { formOf, idOf } from '#lib/server/form.ts';
import { todayIso } from '#lib/format/index.ts';
import {
	StatusChangeError,
	changeStatus,
	deleteProspect,
	deletionImpact,
	getProspect,
	listClients,
	updateProspect
} from '#lib/server/prospects.ts';
import { STATUS_LABEL } from '#lib/labels.ts';
import { fieldErrors } from '#lib/validation/master.ts';
import { ProspectSchema, StatusChangeSchema } from '#lib/validation/prospect.ts';
import type { Actions, PageServerLoad } from './$types';

function load404(rawId: string) {
	const data = getProspect(db, idOf(rawId, 404));
	if (!data) error(404, 'Prospek tidak ditemukan.');
	return data;
}

export const load: PageServerLoad = ({ params }) => {
	const data = load404(params.id);
	const estimates = listEstimates(db, data.prospect.id);
	const final = estimates.find((e) => e.isFinal);
	return {
		...data,
		estimates,
		/** Versi final dan rencana mulainya, untuk isian Deal. */
		final: final ? { version: final.version, plannedStart: getEstimate(db, data.prospect.id, final.version)!.draft.plannedStart } : null,
		projectId: projectIdForProspect(db, data.prospect.id),
		deletion: deletionImpact(db, data.prospect.id),
		clients: listClients(db)
	};
};

export const actions: Actions = {
	/** Hapus permanen beserta riwayat status dan semua versi estimasi. */
	delete: ({ params }) => {
		const { prospect } = load404(params.id);
		try {
			deleteProspect(db, prospect.id);
		} catch (e) {
			if (e instanceof StatusChangeError) return fail(400, { action: 'delete', errors: { _: e.message } });
			throw e;
		}
		redirect(303, '/prospek');
	},

	createEstimate: ({ params }) => {
		const { prospect } = load404(params.id);
		let version: number;
		try {
			version = createEstimate(db, prospect.id, todayIso());
		} catch (e) {
			if (e instanceof EstimateError) return fail(400, { action: 'createEstimate', errors: { _: e.message } });
			throw e;
		}
		redirect(303, `/prospek/${prospect.id}/estimasi/${version}`);
	},

	deleteEstimate: async ({ params, request }) => {
		const { prospect } = load404(params.id);
		const version = idOf((await formOf(request)).version);
		try {
			deleteEstimate(db, prospect.id, version);
		} catch (e) {
			if (e instanceof EstimateError) return fail(400, { action: 'deleteEstimate', errors: { _: e.message } });
			throw e;
		}
		return { message: `Versi ${version} dihapus` };
	},

	update: async ({ params, request }) => {
		const { prospect } = load404(params.id);
		const form = await formOf(request);
		const r = v.safeParse(ProspectSchema, form);
		if (!r.success) return fail(400, { action: 'update', values: form, errors: fieldErrors(r.issues) });
		updateProspect(db, prospect.id, r.output);
		return { message: 'Prospek tersimpan' };
	},

	changeStatus: async ({ params, request }) => {
		const { prospect } = load404(params.id);
		const r = v.safeParse(StatusChangeSchema, await formOf(request));
		if (!r.success) return fail(400, { action: 'changeStatus', errors: fieldErrors(r.issues) });
		let projectId: number | null = null;
		try {
			if (r.output.to === 'deal') projectId = dealProspect(db, prospect.id, r.output.startDate, r.output.note);
			else changeStatus(db, prospect.id, r.output.to, r.output);
		} catch (e) {
			if (e instanceof StatusChangeError) return fail(400, { action: 'changeStatus', errors: { _: e.message } });
			throw e;
		}
		if (projectId !== null) redirect(303, `/proyek/${projectId}`);
		return { message: `Status diubah menjadi ${STATUS_LABEL[r.output.to]}` };
	}
};
