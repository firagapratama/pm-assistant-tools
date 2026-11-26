import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema';

export const DATABASE_PATH = process.env.DATABASE_PATH ?? 'data/app.db';

export function openDb(path = DATABASE_PATH) {
	if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
	const sqlite = new Database(path);
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	sqlite.pragma('busy_timeout = 5000');
	return drizzle(sqlite, { schema });
}

export type Db = ReturnType<typeof openDb>;

export const db = openDb();

/** Transaksi Drizzle; fungsi yang menerima `DbLike` bisa dipakai di dalam maupun di luar transaksi. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbLike = Db | Tx;
