// Dipakai halaman editor estimasi dan endpoint draf AI-nya.
import { error } from '@sveltejs/kit';
import { MODEL, AI_API_KEY, AI_BASE_URL } from '$app/env/private';
import type { AiConfig } from './ai-draft.ts';
import { db } from './db/index.ts';
import { getEstimate } from './estimates.ts';
import { idOf } from './form.ts';
import { getProspect } from './prospects.ts';

/** Prospek dan estimasi dari parameter URL, atau 404. */
export function loadEstimateOr404(params: { id: string; versi: string }) {
	const prospectId = idOf(params.id, 404);
	const version = idOf(params.versi, 404);
	const p = getProspect(db, prospectId);
	const estimate = p && getEstimate(db, prospectId, version);
	if (!p || !estimate) error(404, 'Estimasi tidak ditemukan.');
	return { prospect: p.prospect, estimate };
}

/** Konfigurasi AI dari .env; null bila belum lengkap. */
export const aiConfig = (): AiConfig | null =>
	AI_API_KEY && AI_BASE_URL && MODEL
		? { apiKey: AI_API_KEY, baseUrl: AI_BASE_URL, model: MODEL }
		: null;
