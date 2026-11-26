import { error } from '@sveltejs/kit';

/** Isi form sebagai string (file diabaikan). */
export async function formOf(request: Request): Promise<Record<string, string>> {
	const out: Record<string, string> = {};
	for (const [k, v] of await request.formData()) if (typeof v === 'string') out[k] = v;
	return out;
}

/** ID positif dari string, atau 400/404. */
export function idOf(raw: string | undefined, status: 400 | 404 = 400): number {
	const id = Number(raw);
	if (!Number.isInteger(id) || id <= 0) error(status, status === 404 ? 'Halaman tidak ditemukan.' : 'ID tidak valid.');
	return id;
}
