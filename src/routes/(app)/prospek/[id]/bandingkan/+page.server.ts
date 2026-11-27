import { error, redirect } from '@sveltejs/kit';
import { diffVersions } from '#lib/estimate-diff.ts';
import { db } from '#lib/server/db/index.ts';
import { getEstimate, listEstimates } from '#lib/server/estimates.ts';
import { idOf } from '#lib/server/form.ts';
import { getProspect } from '#lib/server/prospects.ts';
import type { PageServerLoad } from './$types';

/** Perbandingan dua versi estimasi (PRD F7). Bawaan: versi sebelum terakhir → versi terakhir. */
export const load: PageServerLoad = ({ params, url }) => {
	const prospectId = idOf(params.id, 404);
	const p = getProspect(db, prospectId);
	if (!p) error(404, 'Prospek tidak ditemukan.');
	const versions = listEstimates(db, prospectId).map((e) => ({ version: e.version, isFinal: e.isFinal }));
	if (versions.length < 2) redirect(303, `/prospek/${prospectId}`);
	const pick = (key: string, fallback: number) => {
		const n = Number(url.searchParams.get(key));
		return versions.some((v) => v.version === n) ? n : fallback;
	};
	const from = pick('dari', versions[1].version);
	const to = pick('ke', versions[0].version);
	const load = (version: number) => {
		const e = getEstimate(db, prospectId, version)!;
		return { version, draft: e.draft, rates: e.rates, holidays: e.holidays };
	};
	return { prospect: { id: p.prospect.id, name: p.prospect.name }, versions, from, to, diff: diffVersions(load(from), load(to)) };
};
