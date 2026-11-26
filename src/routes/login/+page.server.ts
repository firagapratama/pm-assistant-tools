import { fail, redirect } from '@sveltejs/kit';
import * as v from 'valibot';
import {
	SESSION_COOKIE,
	checkCredentials,
	createSession,
	isLockedOut,
	recordLoginAttempt
} from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import type { Actions, PageServerLoad } from './$types';

const LoginSchema = v.object({
	username: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100)),
	password: v.pipe(v.string(), v.minLength(1), v.maxLength(1000))
});

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(303, '/');
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const form = Object.fromEntries(await request.formData());
		const parsed = v.safeParse(LoginSchema, form);
		const username = typeof form.username === 'string' ? form.username : '';
		if (!parsed.success) return fail(400, { username, message: 'Isi nama pengguna dan password.' });

		const ip = getClientAddress();
		if (isLockedOut(db, ip)) {
			return fail(429, { username, message: 'Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.' });
		}

		const user = await checkCredentials(db, parsed.output.username, parsed.output.password);
		recordLoginAttempt(db, ip, user !== null);
		if (!user) return fail(400, { username, message: 'Nama pengguna atau password salah.' });

		const { token, expiresAt } = createSession(db, user.id);
		cookies.set(SESSION_COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', expires: expiresAt });
		redirect(303, '/');
	}
};
