import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { SESSION_COOKIE, validateSession } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';

const PUBLIC_PATHS = ['/login'];

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	const session = token ? validateSession(db, token) : null;

	if (session && token) {
		event.locals.user = session.user;
		event.cookies.set(SESSION_COOKIE, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			expires: session.expiresAt
		});
	} else {
		event.locals.user = null;
		if (token) event.cookies.delete(SESSION_COOKIE, { path: '/' });
		if (!PUBLIC_PATHS.includes(event.url.pathname)) redirect(303, '/login');
	}

	return resolve(event);
};
