import { error, fail } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { formOf, idOf } from '#lib/server/form.ts';
import {
	ScheduleError,
	deleteActivity,
	getProject,
	resetSchedule,
	saveActivity,
	setHealthOverride,
	updateFeatureSchedule
} from '#lib/server/projects.ts';
import { todayIso } from '#lib/format/index.ts';
import type { Health } from '#lib/project-status.ts';
import { RAID_STATUSES, RAID_TYPES, type RaidStatus, type RaidType } from '#lib/raid.ts';
import { RaidError, deleteRaid, saveRaid } from '#lib/server/raid.ts';
import { ReportError, createWeeklyReport, deleteDraftReport, listReports, saveNarrative, sendReport } from '#lib/server/reports.ts';
import type { Actions, PageServerLoad } from './$types';

function load404(rawId: string) {
	const data = getProject(db, idOf(rawId, 404));
	if (!data) error(404, 'Proyek tidak ditemukan.');
	return data;
}

export const load: PageServerLoad = ({ params }) => {
	const data = load404(params.id);
	return { ...data, reports: listReports(db, data.project.id) };
};

const scale = (v: string | undefined) => (v ? Number(v) : null);
const known = (e: unknown) => e instanceof ScheduleError || e instanceof RaidError || e instanceof ReportError;

export const actions: Actions = {
	updateFeature: async ({ params, request }) => {
		const { project } = load404(params.id);
		const form = await formOf(request);
		try {
			updateFeatureSchedule(db, project.id, idOf(form.featureId), {
				planStart: Number(form.planStart),
				planEnd: Number(form.planEnd),
				progress: Number(form.progress)
			});
		} catch (e) {
			if (e instanceof ScheduleError) return fail(400, { message: e.message });
			throw e;
		}
		return { saved: true };
	},

	/** Buat (tanpa id) atau ubah aktivitas/milestone. */
	saveActivity: async ({ params, request }) => {
		const { project } = load404(params.id);
		const form = await formOf(request);
		try {
			const id = saveActivity(db, project.id, form.id ? idOf(form.id) : null, {
				name: form.name ?? '',
				kind: form.kind === 'milestone' ? 'milestone' : 'aktivitas',
				startDate: form.startDate ?? '',
				endDate: form.endDate ?? '',
				done: form.done === 'true'
			});
			return { activityId: id, message: form.id ? undefined : 'Aktivitas ditambahkan' };
		} catch (e) {
			if (e instanceof ScheduleError) return fail(400, { message: e.message });
			throw e;
		}
	},

	deleteActivity: async ({ params, request }) => {
		const { project } = load404(params.id);
		deleteActivity(db, project.id, idOf((await formOf(request)).id));
		return { message: 'Aktivitas dihapus' };
	},

	saveRaid: async ({ params, request }) => {
		const { project } = load404(params.id);
		const f = await formOf(request);
		try {
			const id = saveRaid(db, project.id, f.id ? idOf(f.id) : null, {
				type: (RAID_TYPES as readonly string[]).includes(f.type) ? (f.type as RaidType) : 'risk',
				description: f.description ?? '',
				owner: f.owner ?? '',
				impact: scale(f.impact),
				likelihood: scale(f.likelihood),
				mitigation: f.mitigation ?? '',
				reviewDate: f.reviewDate || null,
				status: (RAID_STATUSES as readonly string[]).includes(f.status) ? (f.status as RaidStatus) : 'terbuka'
			});
			return { raidId: id, message: f.id ? 'Item RAID tersimpan' : 'Item RAID ditambahkan' };
		} catch (e) {
			if (known(e)) return fail(400, { message: (e as Error).message });
			throw e;
		}
	},

	deleteRaid: async ({ params, request }) => {
		const { project } = load404(params.id);
		deleteRaid(db, project.id, idOf((await formOf(request)).id));
		return { message: 'Item RAID dihapus' };
	},

	createReport: ({ params }) => {
		const { project } = load404(params.id);
		return { reportId: createWeeklyReport(db, project.id, todayIso()) };
	},

	saveNarrative: async ({ params, request }) => {
		const { project } = load404(params.id);
		const f = await formOf(request);
		try {
			saveNarrative(db, project.id, idOf(f.id), {
				achievements: f.achievements ?? '',
				obstacles: f.obstacles ?? '',
				nextWeek: f.nextWeek ?? '',
				helpNeeded: f.helpNeeded ?? ''
			});
		} catch (e) {
			if (known(e)) return fail(400, { message: (e as Error).message });
			throw e;
		}
		return { saved: true };
	},

	sendReport: async ({ params, request }) => {
		const { project } = load404(params.id);
		try {
			sendReport(db, project.id, idOf((await formOf(request)).id), todayIso());
		} catch (e) {
			if (known(e)) return fail(400, { message: (e as Error).message });
			throw e;
		}
		return { message: 'Laporan ditandai terkirim dan diarsipkan' };
	},

	deleteReport: async ({ params, request }) => {
		const { project } = load404(params.id);
		try {
			deleteDraftReport(db, project.id, idOf((await formOf(request)).id));
		} catch (e) {
			if (known(e)) return fail(400, { message: (e as Error).message });
			throw e;
		}
		return { message: 'Draf laporan dihapus' };
	},

	resetSchedule: ({ params }) => {
		const { project } = load404(params.id);
		resetSchedule(db, project.id);
		return { message: 'Rencana dikembalikan ke baseline' };
	},

	setHealth: async ({ params, request }) => {
		const { project } = load404(params.id);
		const form = await formOf(request);
		try {
			setHealthOverride(db, project.id, form.health ? { health: form.health as Health, reason: form.reason ?? '' } : null);
		} catch (e) {
			if (known(e)) return fail(400, { message: (e as Error).message });
			throw e;
		}
		return { message: form.health ? 'Status ditetapkan manual' : 'Status kembali otomatis' };
	}
};
