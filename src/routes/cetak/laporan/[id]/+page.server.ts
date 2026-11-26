import { error } from '@sveltejs/kit';
import { todayIso } from '#lib/format/index.ts';
import { db } from '#lib/server/db/index.ts';
import { idOf } from '#lib/server/form.ts';
import { getProject } from '#lib/server/projects.ts';
import { getReport, liveReportData } from '#lib/server/reports.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const report = getReport(db, idOf(params.id, 404));
	const p = report && getProject(db, report.projectId);
	if (!report || !p) error(404, 'Laporan tidak ditemukan.');
	return {
		report,
		// Laporan terkirim memakai data yang dibekukan; draf dihitung per hari ini.
		content: report.snapshot ?? liveReportData(db, report.projectId, { start: report.periodStart, end: report.periodEnd }, todayIso()),
		project: { id: p.project.id, name: p.prospect.name, client: p.prospect.client }
	};
};
