import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db/index.ts';
import { LibraryError, deleteTemplate, listTemplates, saveTemplate } from './library.ts';
import { createRole } from './master.ts';

let db: Db;
let BE: number;
let QA: number;
const tpl = () => ({
	name: 'Login & reset password',
	category: 'Auth',
	complexity: 'sedang' as const,
	description: 'Login email + OTP',
	assumptions: 'Email via SMTP klien',
	efforts: { [BE]: { o: 8, m: 12, p: 20 }, [QA]: { o: 0, m: 0, p: 0 } }
});

beforeEach(() => {
	db = openDb(':memory:');
	migrate(db, { migrationsFolder: 'drizzle' });
	BE = createRole(db, { name: 'Backend', level: null, source: 'internal' });
	QA = createRole(db, { name: 'QA', level: null, source: 'internal' });
});

describe('library fitur', () => {
	it('tambah, ubah, hapus; effort nol dibuang', () => {
		const id = saveTemplate(db, null, tpl());
		expect(listTemplates(db)).toEqual([expect.objectContaining({ id, name: 'Login & reset password', category: 'Auth', efforts: { [BE]: { o: 8, m: 12, p: 20 } } })]);
		saveTemplate(db, id, { ...tpl(), category: ' ', efforts: { [QA]: { o: 2, m: 3, p: 4 } } });
		expect(listTemplates(db)[0]).toMatchObject({ category: 'Lainnya', efforts: { [QA]: { o: 2, m: 3, p: 4 } } });
		deleteTemplate(db, id);
		expect(listTemplates(db)).toHaveLength(0);
		expect(() => deleteTemplate(db, id)).toThrow(LibraryError);
	});

	it('validasi', () => {
		expect(() => saveTemplate(db, null, { ...tpl(), name: '' })).toThrow(/Nama/);
		expect(() => saveTemplate(db, null, { ...tpl(), efforts: { [BE]: { o: 9, m: 2, p: 3 } } })).toThrow(/optimis/);
		expect(() => saveTemplate(db, null, { ...tpl(), efforts: { 999: { o: 1, m: 2, p: 3 } } })).toThrow(/peran/);
		expect(() => saveTemplate(db, null, { ...tpl(), complexity: 'x' as never })).toThrow(/Kompleksitas/);
		expect(() => saveTemplate(db, 42, tpl())).toThrow(/tidak ditemukan/);
	});
});
