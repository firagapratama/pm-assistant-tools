import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { getEstimateById } from '#lib/server/estimates.ts';
import { idOf } from '#lib/server/form.ts';
import { getProspect } from '#lib/server/prospects.ts';
import { baselineStartFor } from '#lib/server/projects.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const estimate = getEstimateById(db, idOf(params.estimasiId, 404));
	const p = estimate && getProspect(db, estimate.prospectId);
	if (!estimate || !p) error(404, 'Estimasi tidak ditemukan.');
	const { prospect } = p;
	// Estimasi yang menjadi baseline proyek dihitung dengan tanggal mulai proyek, sama seperti baseline-nya.
	const projectStart = baselineStartFor(db, estimate.id);
	return {
		estimate: projectStart ? { ...estimate, draft: { ...estimate.draft, plannedStart: projectStart } } : estimate,
		prospect: { id: prospect.id, name: prospect.name, client: prospect.client, budget: prospect.budget, deadline: prospect.deadline }
	};
};
