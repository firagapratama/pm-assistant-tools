// Kalender kerja: sprint berurutan dari tanggal mulai, dikurangi libur yang jatuh di hari kerja.
// Tanggal selalu string YYYY-MM-DD dan dihitung dalam UTC agar tidak terpengaruh zona waktu.
import type { EstimateSettings } from './settings';

export type HolidayType = 'nasional' | 'cuti_bersama';

export interface Holiday {
	date: string;
	name: string;
	type: HolidayType;
}

export interface SprintWindow {
	number: number;
	from: string;
	to: string;
	/** Hari kerja tersedia setelah dikurangi libur. */
	workingDays: number;
	/** Libur yang jatuh di hari kerja (Senin–Jumat) dalam sprint ini. */
	holidays: Holiday[];
}

const DAY = 86_400_000;
const toMs = (iso: string) => {
	const [y, m, d] = iso.split('-').map(Number);
	return Date.UTC(y, m - 1, d);
};
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => toIso(toMs(iso) + n * DAY);
export const isWeekday = (iso: string) => {
	const d = new Date(toMs(iso)).getUTCDay();
	return d !== 0 && d !== 6;
};

/** Indeks libur hari kerja per tanggal (satu tanggal dihitung sekali). */
export function weekdayHolidays(holidays: Holiday[]): Map<string, Holiday> {
	const map = new Map<string, Holiday>();
	for (const h of holidays) if (isWeekday(h.date) && !map.has(h.date)) map.set(h.date, h);
	return map;
}

export class WorkCalendar {
	private readonly index: Map<string, Holiday>;
	private readonly cache = new Map<number, SprintWindow>();

	constructor(
		readonly start: string,
		private readonly s: EstimateSettings,
		holidays: Holiday[]
	) {
		this.index = weekdayHolidays(holidays);
	}

	/** Sprint ke-i (mulai 0). */
	sprint(i: number): SprintWindow {
		const cached = this.cache.get(i);
		if (cached) return cached;
		const len = this.s.sprintWeeks * 7;
		const from = addDays(this.start, i * len);
		const to = addDays(from, len - 1);
		const holidays: Holiday[] = [];
		for (let d = 0; d < len; d++) {
			const h = this.index.get(addDays(from, d));
			if (h) holidays.push(h);
		}
		const w = { number: i + 1, from, to, workingDays: Math.max(0, this.s.workDaysPerSprint - holidays.length), holidays };
		this.cache.set(i, w);
		return w;
	}

	/** Porsi kapasitas normal yang tersedia di sprint ke-i (0–1). */
	factor = (i: number) => (this.s.workDaysPerSprint > 0 ? this.sprint(i).workingDays / this.s.workDaysPerSprint : 1);

	/** Hari kerja terakhir pada atau sebelum `iso` (bukan akhir pekan, bukan libur). */
	workdayOnOrBefore(iso: string): string {
		let d = iso;
		while (!isWeekday(d) || this.index.has(d)) d = addDays(d, -1);
		return d;
	}

	/** Hari kerja terakhir dari sprint ke-(count). */
	endDate(count: number): string {
		return count <= 0 ? this.start : this.workdayOnOrBefore(this.sprint(count - 1).to);
	}

	/** Jumlah sprint terbanyak yang selesai paling lambat pada `deadline` (YYYY-MM-DD). */
	sprintsUntil(deadline: string): number {
		let n = 0;
		while (n < 1000 && this.endDate(n + 1) <= deadline) n++;
		return n;
	}

	schedule(count: number): SprintWindow[] {
		return Array.from({ length: count }, (_, i) => this.sprint(i));
	}
}
