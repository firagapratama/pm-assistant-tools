import { error, fail } from '@sveltejs/kit';
import * as v from 'valibot';
import { db } from '#lib/server/db/index.ts';
import { formOf, idOf } from '#lib/server/form.ts';
import {
	DuplicateRoleError,
	createRole,
	deleteRate,
	getSettings,
	listRoles,
	saveSettings,
	setRate,
	setRoleActive,
	updateRole
} from '#lib/server/master.ts';
import { todayIso } from '#lib/format/index.ts';
import { STANDARD_ROLES } from '#lib/labels.ts';
import { NewRoleSchema, RateSchema, RoleSchema, SettingsSchema, fieldErrors } from '#lib/validation/master.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const today = todayIso();
	return { roles: listRoles(db, today), settings: getSettings(db), today };
};

function roleNotFound(id: number) {
	if (!listRoles(db, todayIso()).some((r) => r.id === id)) error(404, 'Peran tidak ditemukan.');
}

export const actions: Actions = {
	createRole: async ({ request }) => {
		const form = await formOf(request);
		const r = v.safeParse(NewRoleSchema, form);
		if (!r.success) return fail(400, { action: 'createRole', errors: fieldErrors(r.issues) });
		const { monthlyRate, effectiveFrom, ...role } = r.output;
		try {
			createRole(db, role, monthlyRate === null ? undefined : { monthlyRate, effectiveFrom });
		} catch (e) {
			if (e instanceof DuplicateRoleError) return fail(400, { action: 'createRole', errors: { name: e.message } });
			throw e;
		}
		return { message: 'Peran ditambahkan' };
	},

	updateRole: async ({ request }) => {
		const form = await formOf(request);
		const id = idOf(form.id);
		roleNotFound(id);
		const r = v.safeParse(RoleSchema, form);
		if (!r.success) return fail(400, { action: 'updateRole', id, errors: fieldErrors(r.issues) });
		try {
			updateRole(db, id, r.output);
		} catch (e) {
			if (e instanceof DuplicateRoleError) return fail(400, { action: 'updateRole', id, errors: { name: e.message } });
			throw e;
		}
		return { message: 'Peran tersimpan' };
	},

	setActive: async ({ request }) => {
		const form = await formOf(request);
		const id = idOf(form.id);
		roleNotFound(id);
		const active = form.active === 'true';
		setRoleActive(db, id, active);
		return { message: active ? 'Peran diaktifkan' : 'Peran dinonaktifkan' };
	},

	setRate: async ({ request }) => {
		const form = await formOf(request);
		const id = idOf(form.id);
		roleNotFound(id);
		const r = v.safeParse(RateSchema, form);
		if (!r.success) return fail(400, { action: 'setRate', id, errors: fieldErrors(r.issues) });
		setRate(db, id, r.output.monthlyRate, r.output.effectiveFrom);
		return { message: 'Rate tersimpan' };
	},

	deleteRate: async ({ request }) => {
		const form = await formOf(request);
		deleteRate(db, idOf(form.rateId));
		return { message: 'Rate dihapus' };
	},

	seedRoles: () => {
		if (listRoles(db, todayIso()).length > 0) return fail(400, { action: 'seedRoles', errors: { _: 'Peran sudah ada.' } });
		for (const name of STANDARD_ROLES) createRole(db, { name, level: null, source: 'internal' });
		return { message: 'Peran standar ditambahkan' };
	},

	saveSettings: async ({ request }) => {
		const r = v.safeParse(SettingsSchema, await formOf(request));
		if (!r.success) return fail(400, { action: 'saveSettings', errors: fieldErrors(r.issues) });
		saveSettings(db, r.output);
		return { message: 'Parameter tersimpan' };
	}
};
