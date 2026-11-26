import { fail } from '@sveltejs/kit';
import * as v from 'valibot';
import { todayIso } from '#lib/format/index.ts';
import { db } from '#lib/server/db/index.ts';
import { aiConfig, loadEstimateOr404 } from '#lib/server/estimate-context.ts';
import { EstimateError, finalizeEstimate, refreshRates, saveEstimate } from '#lib/server/estimates.ts';
import { formOf } from '#lib/server/form.ts';
import { LibraryError, listTemplates, saveTemplate } from '#lib/server/library.ts';
import { DraftFeatureSchema, EstimateDraftSchema } from '#lib/validation/estimate.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const { prospect, estimate } = loadEstimateOr404(params);
	const ai = aiConfig();
	return {
		ai: ai ? { model: ai.model } : null,
		prospect: {
			id: prospect.id,
			name: prospect.name,
			client: prospect.client,
			status: prospect.status,
			budget: prospect.budget,
			deadline: prospect.deadline,
			needs: prospect.needs
		},
		estimate,
		library: listTemplates(db)
	};
};

const failWith = (action: string, e: unknown) => {
	if (e instanceof EstimateError) return fail(400, { action, message: e.message });
	throw e;
};

export const actions: Actions = {
	/** Simpan otomatis dari editor: seluruh isi estimasi sebagai JSON. */
	save: async ({ params, request }) => {
		const { estimate } = loadEstimateOr404(params);
		let json: unknown;
		try {
			json = JSON.parse((await formOf(request)).payload ?? '');
		} catch {
			return fail(400, { action: 'save', message: 'Data estimasi tidak terbaca.' });
		}
		const r = v.safeParse(EstimateDraftSchema, json);
		if (!r.success) return fail(400, { action: 'save', message: 'Ada isian yang belum valid.' });
		try {
			saveEstimate(db, estimate.id, r.output);
		} catch (e) {
			return failWith('save', e);
		}
		return { saved: true };
	},

	/** Menyimpan satu fitur estimasi sebagai template baru di library (salinan). */
	saveToLibrary: async ({ params, request }) => {
		loadEstimateOr404(params);
		let json: unknown;
		try {
			json = JSON.parse((await formOf(request)).payload ?? '');
		} catch {
			return fail(400, { action: 'saveToLibrary', message: 'Data fitur tidak terbaca.' });
		}
		const r = v.safeParse(DraftFeatureSchema, json);
		if (!r.success) return fail(400, { action: 'saveToLibrary', message: 'Isian fitur belum valid.' });
		const f = r.output;
		try {
			saveTemplate(db, null, { name: f.name, category: f.module, complexity: 'sedang', description: f.description, assumptions: f.assumptions, efforts: f.efforts });
		} catch (e) {
			if (e instanceof LibraryError) return fail(400, { action: 'saveToLibrary', message: e.message });
			throw e;
		}
		return { message: `"${f.name}" disimpan ke library` };
	},

	refreshRates: ({ params }) => {
		const { estimate } = loadEstimateOr404(params);
		try {
			refreshRates(db, estimate.id, todayIso());
		} catch (e) {
			return failWith('refreshRates', e);
		}
		return { message: 'Rate dan kalender terbaru diambil' };
	},

	finalize: ({ params }) => {
		const { prospect, estimate } = loadEstimateOr404(params);
		try {
			finalizeEstimate(db, prospect.id, estimate.version);
		} catch (e) {
			return failWith('finalize', e);
		}
		return { message: `Versi ${estimate.version} ditandai final` };
	}
};
