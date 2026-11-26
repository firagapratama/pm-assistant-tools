// pnpm db:migrate — menerapkan file migrasi di ./drizzle ke database.
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { DATABASE_PATH, db } from '../src/lib/server/db/index.ts';

migrate(db, { migrationsFolder: 'drizzle' });
console.log(`Migrasi selesai: ${DATABASE_PATH}`);
