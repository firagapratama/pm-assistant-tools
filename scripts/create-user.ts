// pnpm create-user <username> — membuat akun (atau mengganti password bila sudah ada).
import { eq } from 'drizzle-orm';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { hashPassword } from '../src/lib/server/auth.ts';
import { db } from '../src/lib/server/db/index.ts';
import { sessions, users } from '../src/lib/server/db/schema.ts';

const MIN_LENGTH = 12;

function askHidden(question: string): Promise<string> {
	let muted = false;
	const output = new Writable({
		write(chunk, _enc, cb) {
			if (!muted) process.stdout.write(chunk);
			cb();
		}
	});
	const rl = createInterface({ input: process.stdin, output, terminal: true });
	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close();
			process.stdout.write('\n');
			resolve(answer);
		});
		muted = true;
	});
}

const username = process.argv[2];
if (!username) {
	console.error('Pemakaian: pnpm create-user <username>');
	process.exit(1);
}

const password = await askHidden('Password: ');
if (password.length < MIN_LENGTH) {
	console.error(`Password minimal ${MIN_LENGTH} karakter.`);
	process.exit(1);
}
if ((await askHidden('Ulangi password: ')) !== password) {
	console.error('Password tidak sama.');
	process.exit(1);
}

const passwordHash = await hashPassword(password);
const existing = db.select().from(users).where(eq(users.username, username)).get();
if (existing) {
	db.update(users).set({ passwordHash }).where(eq(users.id, existing.id)).run();
	db.delete(sessions).where(eq(sessions.userId, existing.id)).run();
	console.log(`Password ${username} diperbarui; semua sesi lama dikeluarkan.`);
} else {
	db.insert(users).values({ username, passwordHash }).run();
	console.log(`Akun ${username} dibuat.`);
}
