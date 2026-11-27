// Ketersediaan tim di proyek berjalan: cuti, sakit (mengurangi kapasitas) dan lembur (menambah), per peran.
import type { WorkCalendar } from './calc/calendar.ts';
import type { EstimateSettings } from './calc/settings.ts';

export const AVAILABILITY_KINDS = ['cuti', 'sakit', 'lembur'] as const;
export type AvailabilityKind = (typeof AVAILABILITY_KINDS)[number];
export const AVAILABILITY_LABEL: Record<AvailabilityKind, string> = { cuti: 'Cuti', sakit: 'Sakit', lembur: 'Lembur' };

export interface AvailabilityEntry {
	roleId: number;
	kind: AvailabilityKind;
	/** Jumlah orang (boleh desimal untuk paruh waktu). */
	people: number;
	startDate: string;
	endDate: string;
	/** Lembur: jam per orang per hari kerja. */
	hours: number;
}

/**
 * Dampak ke jadwal per peran, dalam hari kerja: (jam hilang − jam lembur) ÷ kapasitas harian peran.
 * Hanya peran yang punya pekerjaan fitur (`deliveryRoleIds`); proyek mundur sebesar dampak terbesar.
 */
export function availabilityImpact(
	entries: AvailabilityEntry[],
	team: { roleId: number; name: string; mp: number }[],
	deliveryRoleIds: Set<number>,
	settings: EstimateSettings,
	calendar: WorkCalendar
) {
	const byRole = team
		.filter((t) => t.mp > 0 && deliveryRoleIds.has(t.roleId))
		.map((t) => {
			let lostDays = 0; // orang-hari tidak hadir
			let overtimeHours = 0;
			for (const e of entries.filter((x) => x.roleId === t.roleId)) {
				const days = calendar.workdaysBetween(e.startDate, e.endDate);
				if (e.kind === 'lembur') overtimeHours += e.people * e.hours * days;
				else lostDays += e.people * days;
			}
			// Kapasitas harian peran = mp × jam efektif; focus factor berlaku sama di kedua sisi.
			const netHours = lostDays * settings.effectiveHoursPerDay - overtimeHours;
			const delayDays = netHours / (t.mp * settings.effectiveHoursPerDay);
			return { roleId: t.roleId, name: t.name, lostDays, overtimeHours, delayDays };
		})
		.filter((r) => r.lostDays > 0 || r.overtimeHours > 0);
	const worst = byRole.length ? Math.max(...byRole.map((r) => r.delayDays)) : 0;
	// Mundur dibulatkan ke atas (hari kerja penuh), maju dibulatkan ke bawah agar tidak terlalu optimis.
	const shiftDays = worst > 0 ? Math.ceil(worst - 1e-9) : Math.trunc(worst);
	return { byRole, shiftDays };
}
