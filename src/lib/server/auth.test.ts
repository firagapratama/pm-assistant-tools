import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	MAX_FAILED_LOGINS,
	SESSION_TTL,
	checkCredentials,
	createSession,
	hashPassword,
	invalidateSession,
	isLockedOut,
	recordLoginAttempt,
	validateSession
} from './auth';
import { openDb, type Db } from './db';
import { users } from './db/schema';

let db: Db;
beforeEach(async () => {
	db = openDb(':memory:');
	migrate(db, { migrationsFolder: 'drizzle' });
	db.insert(users).values({ username: 'pm', passwordHash: await hashPassword('rahasia-kuat-123') }).run();
});

describe('auth', () => {
	it('memeriksa password', async () => {
		expect(await checkCredentials(db, 'pm', 'rahasia-kuat-123')).toMatchObject({ username: 'pm' });
		expect(await checkCredentials(db, 'pm', 'salah')).toBeNull();
		expect(await checkCredentials(db, 'bukan', 'rahasia-kuat-123')).toBeNull();
	});

	it('sesi valid, diperpanjang, dan bisa dihapus', () => {
		const now = Date.now();
		const { token } = createSession(db, 1, now);
		expect(validateSession(db, token, now)?.user.username).toBe('pm');
		expect(validateSession(db, 'token-palsu', now)).toBeNull();

		const later = now + SESSION_TTL - 1000; // hampir kedaluwarsa → diperpanjang
		expect(validateSession(db, token, later)!.expiresAt.getTime()).toBe(later + SESSION_TTL);

		invalidateSession(db, token);
		expect(validateSession(db, token, later)).toBeNull();
	});

	it('sesi kedaluwarsa ditolak', () => {
		const now = Date.now();
		const { token } = createSession(db, 1, now);
		expect(validateSession(db, token, now + SESSION_TTL + 1)).toBeNull();
	});

	it(`terkunci setelah ${MAX_FAILED_LOGINS} kali gagal, dibuka oleh login berhasil`, () => {
		for (let i = 0; i < MAX_FAILED_LOGINS - 1; i++) recordLoginAttempt(db, '1.2.3.4', false);
		expect(isLockedOut(db, '1.2.3.4')).toBe(false);
		recordLoginAttempt(db, '1.2.3.4', false);
		expect(isLockedOut(db, '1.2.3.4')).toBe(true);
		expect(isLockedOut(db, '5.6.7.8')).toBe(false);
		recordLoginAttempt(db, '1.2.3.4', true);
		expect(isLockedOut(db, '1.2.3.4')).toBe(false);
	});
});
