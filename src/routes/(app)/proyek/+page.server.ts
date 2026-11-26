import { db } from '#lib/server/db/index.ts';
import { listProjects } from '#lib/server/projects.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ projects: listProjects(db) });
