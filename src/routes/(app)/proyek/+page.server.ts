import { db } from '#lib/server/db/index.ts';
import { todayIso } from '#lib/format/index.ts';
import { projectDashboard } from '#lib/server/projects.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const today = todayIso();
	return { today, projects: projectDashboard(db, today) };
};
