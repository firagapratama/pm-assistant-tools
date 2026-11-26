import { fail } from '@sveltejs/kit';
import { todayIso } from '#lib/format/index.ts';
import { roleLabel } from '#lib/labels.ts';
import { db } from '#lib/server/db/index.ts';
import { formOf, idOf } from '#lib/server/form.ts';
import { LibraryError, deleteTemplate, listTemplates, saveTemplate, type Complexity } from '#lib/server/library.ts';
import { listRoles } from '#lib/server/master.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const templates = listTemplates(db);
	const used = new Set(templates.flatMap((t) => Object.keys(t.efforts).map(Number)));
	return {
		templates,
		// Peran aktif, ditambah peran nonaktif yang masih dipakai template.
		roles: listRoles(db, todayIso())
			.filter((r) => r.active || used.has(r.id))
			.map((r) => ({ id: r.id, label: roleLabel(r), active: r.active }))
	};
};

function efforts(raw: string | undefined) {
	try {
		const v = JSON.parse(raw ?? '{}');
		if (v && typeof v === 'object' && !Array.isArray(v)) return v;
	} catch {
		/* ditolak di bawah */
	}
	throw new LibraryError('Effort tidak valid.');
}

const known = (e: unknown) => {
	if (e instanceof LibraryError) return fail(400, { message: e.message });
	throw e;
};

export const actions: Actions = {
	save: async ({ request }) => {
		const form = await formOf(request);
		try {
			const id = saveTemplate(db, form.id ? idOf(form.id) : null, {
				name: form.name ?? '',
				category: form.category ?? '',
				complexity: (form.complexity ?? 'sedang') as Complexity,
				description: form.description ?? '',
				assumptions: form.assumptions ?? '',
				efforts: efforts(form.efforts)
			});
			return { message: 'Template disimpan', templateId: id };
		} catch (e) {
			return known(e);
		}
	},
	delete: async ({ request }) => {
		const form = await formOf(request);
		try {
			deleteTemplate(db, idOf(form.id));
		} catch (e) {
			return known(e);
		}
		return { message: 'Template dihapus' };
	}
};
