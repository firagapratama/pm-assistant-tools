import { todayIso } from '#lib/format/index.ts';
import { dashboardData } from '#lib/server/dashboard.ts';
import { db } from '#lib/server/db/index.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => dashboardData(db, todayIso());
