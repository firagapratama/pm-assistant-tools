// Sesi cookie buatan sendiri (tech-stack bagian 6).
import { hash, verify } from '@node-rs/argon2';
import { and, count, eq, gt } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import type { Db } from './db';
import { loginAttempts, sessions, users } from './db/schema';

export const SESSION_COOKIE = 'sesi';
const DAY = 24 * 60 * 60 * 1000;
export const SESSION_TTL = 30 * DAY;
const RENEW_BEFORE = 15 * DAY;

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export const hashPassword = (password: string) => hash(password);

/** Hash palsu untuk menyamakan waktu respons saat username tidak ditemukan. */
let dummyHash: Promise<string> | undefined;

export async function checkCredentials(db: Db, username: string, password: string) {
	const user = db.select().from(users).where(eq(users.username, username)).get();
	if (!user) {
		await verify(await (dummyHash ??= hash('dummy-password')), password);
		return null;
	}
	return (await verify(user.passwordHash, password)) ? user : null;
}

export function isLockedOut(db: Db, ip: string, now = Date.now()) {
	const since = new Date(now - LOCKOUT_MS);
	const row = db
		.select({ n: count() })
		.from(loginAttempts)
		.where(and(eq(loginAttempts.ip, ip), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, since)))
		.get();
	return (row?.n ?? 0) >= MAX_FAILED_LOGINS;
}

export function recordLoginAttempt(db: Db, ip: string, success: boolean) {
	db.insert(loginAttempts).values({ ip, success }).run();
	// Login berhasil menghapus hitungan gagal dari IP tersebut.
	if (success) db.delete(loginAttempts).where(and(eq(loginAttempts.ip, ip), eq(loginAttempts.success, false))).run();
}

export function createSession(db: Db, userId: number, now = Date.now()) {
	const token = randomBytes(32).toString('base64url');
	const expiresAt = new Date(now + SESSION_TTL);
	db.insert(sessions).values({ id: sha256(token), userId, expiresAt }).run();
	return { token, expiresAt };
}

/** Mengembalikan pengguna bila sesi valid; memperpanjang sesi yang mendekati kedaluwarsa. */
export function validateSession(db: Db, token: string, now = Date.now()) {
	const id = sha256(token);
	const row = db
		.select({ user: { id: users.id, username: users.username }, expiresAt: sessions.expiresAt })
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.id, id))
		.get();
	if (!row) return null;
	if (row.expiresAt.getTime() <= now) {
		db.delete(sessions).where(eq(sessions.id, id)).run();
		return null;
	}
	let expiresAt = row.expiresAt;
	if (expiresAt.getTime() - now < RENEW_BEFORE) {
		expiresAt = new Date(now + SESSION_TTL);
		db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id)).run();
	}
	return { user: row.user, expiresAt };
}

export function invalidateSession(db: Db, token: string) {
	db.delete(sessions).where(eq(sessions.id, sha256(token))).run();
}
