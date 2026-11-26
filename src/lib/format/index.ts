// Format Indonesia (design.md bagian 7).
const MINUS = '−';

const intFmt = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

/** Rp279.450.000 */
export function rupiah(amount: number): string {
	const s = 'Rp' + intFmt.format(Math.abs(Math.round(amount)));
	return amount < 0 ? MINUS + s : s;
}

/** Rp279,5 jt · Rp1,2 M (ringkasan). */
export function rupiahShort(amount: number): string {
	const abs = Math.abs(amount);
	const [div, suffix] =
		abs >= 1e12 ? [1e12, ' T'] : abs >= 1e9 ? [1e9, ' M'] : abs >= 1e6 ? [1e6, ' jt'] : abs >= 1e3 ? [1e3, ' rb'] : [1, ''];
	const s = 'Rp' + decimal(abs / div, div === 1 ? 0 : 1) + suffix;
	return amount < 0 ? MINUS + s : s;
}

/** 3,75 — koma desimal, maksimal `digits` angka di belakang koma. */
export function decimal(value: number, digits = 2): string {
	return new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(value);
}

/** 15% dari basis poin. */
export const percentBp = (bp: number) => decimal(bp / 100, 2) + '%';

/** 26 Nov 2026 */
export function date(d: Date | string | number): string {
	return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
		.format(new Date(d))
		.replace('.', '');
}

/**
 * Membaca angka yang diketik pengguna Indonesia: "15.000.000", "Rp 15.000.000", "0,8", "12,5".
 * Titik dianggap pemisah ribuan hanya jika polanya ribuan (1.000 / 15.000.000); selain itu desimal.
 * Mengembalikan NaN jika tidak valid.
 */
export function parseNumber(input: string): number {
	let s = input.replace(/rp/i, '').replace(/[\s%]/g, '');
	if (s === '') return NaN;
	if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
	else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
	return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

/** Tanggal lokal hari ini, YYYY-MM-DD. */
export function todayIso(now = new Date()): string {
	const p = (n: number) => String(n).padStart(2, '0');
	return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** 26 November 2026 (dokumen) */
export function dateLong(d: Date | string | number): string {
	return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d));
}

/** Baris tidak kosong dari teks multi-baris (asumsi, risiko). */
export const lines = (text: string) =>
	text
		.split('\n')
		.map((l) => l.replace(/^\s*[-•·*]\s*/, '').trim())
		.filter(Boolean);

/** "hari ini", "kemarin", "3 hari lalu"; lebih dari 30 hari memakai tanggal. */
export function daysAgo(d: Date | string | number, now = new Date()): string {
	const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
	const days = Math.round((startOfDay(now) - startOfDay(new Date(d))) / 86_400_000);
	if (days <= 0) return 'hari ini';
	if (days === 1) return 'kemarin';
	if (days <= 30) return `${days} hari lalu`;
	return date(d);
}

/** 5–7 */
export const range = (lo: string, hi: string) => (lo === hi ? lo : `${lo}–${hi}`);
