import * as v from 'valibot';
import { db } from '#lib/server/db/index.ts';
import { listClients, listProspects } from '#lib/server/prospects.ts';
import { ProspectFilterSchema } from '#lib/validation/prospect.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const parsed = v.safeParse(ProspectFilterSchema, Object.fromEntries(url.searchParams));
	const filter = parsed.success ? parsed.output : { q: '', status: '' as const, client: '' };
	const isFiltered = Boolean(filter.q || filter.status || filter.client);
	return {
		filter,
		view: url.searchParams.get('tampilan') === 'kanban' ? ('kanban' as const) : ('daftar' as const),
		prospects: listProspects(db, filter),
		hasAny: isFiltered ? listProspects(db).length > 0 : undefined,
		clients: listClients(db)
	};
};
