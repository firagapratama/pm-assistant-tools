import { error, fail } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { formOf, idOf } from '#lib/server/form.ts';
import {
	ScheduleError,
	deleteActivity,
	getProject,
	resetSchedule,
	saveActivity,
	updateFeatureSchedule
} from '#lib/server/projects.ts';
import type { Actions, PageServerLoad } from './$types';

function load404(rawId: string) {
	const data = getProject(db, idOf(rawId, 404));
	if (!data) error(404, 'Proyek tidak ditemukan.');
	return data;
}

export const load: PageServerLoad = ({ params }) => load404(params.id);

export const actions: Actions = {
	updateFeature: async ({ params, request }) => {
		const { project } = load404(params.id);
		const form = await formOf(request);
		try {
			updateFeatureSchedule(db, project.id, idOf(form.featureId), {
				planStart: Number(form.planStart),
				planEnd: Number(form.planEnd),
				progress: Number(form.progress)
			});
		} catch (e) {
			if (e instanceof ScheduleError) return fail(400, { message: e.message });
			throw e;
		}
		return { saved: true };
	},

	/** Buat (tanpa id) atau ubah aktivitas/milestone. */
	saveActivity: async ({ params, request }) => {
		const { project } = load404(params.id);
		const form = await formOf(request);
		try {
			const id = saveActivity(db, project.id, form.id ? idOf(form.id) : null, {
				name: form.name ?? '',
				kind: form.kind === 'milestone' ? 'milestone' : 'aktivitas',
				startDate: form.startDate ?? '',
				endDate: form.endDate ?? '',
				done: form.done === 'true'
			});
			return { activityId: id, message: form.id ? undefined : 'Aktivitas ditambahkan' };
		} catch (e) {
			if (e instanceof ScheduleError) return fail(400, { message: e.message });
			throw e;
		}
	},

	deleteActivity: async ({ params, request }) => {
		const { project } = load404(params.id);
		deleteActivity(db, project.id, idOf((await formOf(request)).id));
		return { message: 'Aktivitas dihapus' };
	},

	resetSchedule: ({ params }) => {
		const { project } = load404(params.id);
		resetSchedule(db, project.id);
		return { message: 'Rencana dikembalikan ke baseline' };
	}
};
