// Dipakai halaman editor estimasi dan endpoint draf AI-nya.
import { error } from '@sveltejs/kit';
import { AI_API_KEY, AI_BASE_URL, AI_MODEL, MODEL } from '$app/env/private';
import type { AiConfig } from './ai-draft.ts';
import { db } from './db/index.ts';
import { getEstimate } from './estimates.ts';
import { getAiEnabled } from './master.ts';
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

/** Konfigurasi AI dari .env saja; null bila belum lengkap. */
export function aiEnvConfig(): AiConfig | null {
	const model = AI_MODEL ?? MODEL;
	return AI_API_KEY && AI_BASE_URL && model ? { apiKey: AI_API_KEY, baseUrl: AI_BASE_URL, model } : null;
}

/** Konfigurasi AI yang boleh dipakai: lengkap di .env dan tidak dimatikan di Pengaturan. */
export const aiConfig = (): AiConfig | null => (getAiEnabled(db) ? aiEnvConfig() : null);

/** Penyedia AI untuk ditampilkan dan dicatat: host dari AI_BASE_URL. */
export const aiProvider = (config: AiConfig) => {
	try {
		return new URL(config.baseUrl).host;
	} catch {
		return config.baseUrl;
	}
};
