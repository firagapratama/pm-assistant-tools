import { describe, expect, it } from 'vitest';
import { date, dateLong, daysAgo, lines, decimal, parseNumber, percentBp, range, rupiah, rupiahShort, todayIso } from './index';

describe('membaca angka', () => {
	it('format Indonesia', () => {
		expect(parseNumber('15.000.000')).toBe(15_000_000);
		expect(parseNumber('Rp 15.000.000')).toBe(15_000_000);
		expect(parseNumber('15000000')).toBe(15_000_000);
		expect(parseNumber('0,8')).toBe(0.8);
		expect(parseNumber('1.234,5')).toBe(1234.5);
		expect(parseNumber('12,5%')).toBe(12.5);
		expect(parseNumber('0.8')).toBe(0.8);
		expect(parseNumber('2')).toBe(2);
	});

	it('menolak input tidak valid', () => {
		for (const s of ['', 'abc', '1,2,3', '1.2.3', '12a']) expect(parseNumber(s)).toBeNaN();
	});

	it('tanggal hari ini', () => {
		expect(todayIso(new Date(2026, 0, 5))).toBe('2026-01-05');
	});

	it('tanggal panjang dan baris daftar', () => {
		expect(dateLong('2026-11-26T12:00:00')).toBe('26 November 2026');
		expect(lines('- API tersedia\n\n• Desain ada \n  Data bersih')).toEqual(['API tersedia', 'Desain ada', 'Data bersih']);
	});

	it('hari lalu', () => {
		const now = new Date(2026, 10, 26, 9);
		expect(daysAgo(new Date(2026, 10, 26, 1), now)).toBe('hari ini');
		expect(daysAgo(new Date(2026, 10, 25, 23), now)).toBe('kemarin');
		expect(daysAgo(new Date(2026, 10, 23, 12), now)).toBe('3 hari lalu');
		expect(daysAgo(new Date(2026, 8, 1, 12), now)).toBe('1 Sep 2026');
	});
});

describe('format Indonesia', () => {
	it('rupiah lengkap', () => {
		expect(rupiah(279_450_000)).toBe('Rp279.450.000');
		expect(rupiah(0)).toBe('Rp0');
		expect(rupiah(-1500)).toBe('−Rp1.500');
	});

	it('rupiah singkat', () => {
		expect(rupiahShort(279_450_000)).toBe('Rp279,5 jt');
		expect(rupiahShort(363_285_000)).toBe('Rp363,3 jt');
		expect(rupiahShort(1_200_000_000)).toBe('Rp1,2 M');
		expect(rupiahShort(15_000_000)).toBe('Rp15 jt');
	});

	it('desimal, persen, rentang, tanggal', () => {
		expect(decimal(3.75)).toBe('3,75');
		expect(decimal(4.16667, 1)).toBe('4,2');
		expect(percentBp(1500)).toBe('15%');
		expect(range('5', '7')).toBe('5–7');
		expect(range('6', '6')).toBe('6');
		expect(date('2026-11-26T12:00:00')).toBe('26 Nov 2026');
	});
});
