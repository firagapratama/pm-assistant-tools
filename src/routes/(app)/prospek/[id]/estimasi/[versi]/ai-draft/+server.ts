// POST draf fitur dengan AI (PRD F4), dua langkah:
// - { action: 'preview', notes, anonymize } → JSON teks persis yang akan dikirim (PM boleh mengeditnya).
// - { action: 'generate', text, anonymize } → Server-Sent Events (progress → done | error).
// Hasil tidak disimpan; editor memasukkannya sebagai fitur "draf AI" yang wajib ditinjau.
import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import { roleLabel } from '#lib/labels.ts';
import { AiDraftError, anonymize, buildMessages, buildUserText, generateDraft, restoreNames } from '#lib/server/ai-draft.ts';
import { db } from '#lib/server/db/index.ts';
import { aiConfig, aiProvider, loadEstimateOr404 } from '#lib/server/estimate-context.ts';
import { logAiCall } from '#lib/server/master.ts';
import type { RequestHandler } from './$types';

const BodySchema = v.variant('action', [
	v.object({ action: v.literal('preview'), notes: v.optional(v.pipe(v.string(), v.maxLength(20_000)), ''), anonymize: v.boolean() }),
	v.object({ action: v.literal('generate'), text: v.pipe(v.string(), v.minLength(1), v.maxLength(40_000)), anonymize: v.boolean() })
]);

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

function errorStream(message: string) {
	return new Response(sse('error', { message }), { headers: { 'Content-Type': 'text/event-stream' } });
}

/** Satu permintaan AI berjalan pada satu waktu (tech-stack 4.3). */
let busy = false;

export const POST: RequestHandler = async ({ params, request }) => {
	const { prospect, estimate } = loadEstimateOr404(params);
	const config = aiConfig();
	const body = v.safeParse(BodySchema, await request.json().catch(() => null));
	const fail = (message: string, status = 400) => (body.success && body.output.action === 'preview' ? json({ message }, { status }) : errorStream(message));
	if (estimate.isFinal) return fail('Estimasi final terkunci.');
	if (!config) return fail('Draf AI tidak aktif. Nyalakan di Pengaturan dan isi AI_API_KEY, AI_BASE_URL, dan AI_MODEL di .env.');
	if (!body.success) return fail('Permintaan tidak valid.');

	const names = { project: prospect.name, client: prospect.client };
	const input = {
		projectName: prospect.name,
		needs: prospect.needs,
		businessGoal: prospect.businessGoal,
		notes: body.output.action === 'preview' ? body.output.notes : '',
		roles: estimate.rates.map((r) => ({ id: r.roleId, name: roleLabel(r) })),
		existingFeatures: estimate.draft.features.map((f) => f.name).filter(Boolean)
	};

	if (body.output.action === 'preview') {
		if (!prospect.needs.trim() && !body.output.notes.trim()) return fail('Isi ringkasan kebutuhan prospek atau catatan tambahan terlebih dahulu.');
		const text = buildUserText(input);
		return json({ text: body.output.anonymize ? anonymize(text, names) : text, provider: aiProvider(config), model: config.model });
	}

	if (busy) return errorStream('Masih ada permintaan AI yang berjalan. Tunggu sampai selesai.');
	busy = true;
	const { text, anonymize: anonymized } = body.output;
	// Penyamaran diulang di server: nama yang diketik ulang PM di pratinjau tetap tersamar.
	const userText = anonymized ? anonymize(text, names) : text;
	const chars = buildMessages(input, userText).reduce((a, m) => a + m.content.length, 0);

	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const send = (event: string, data: unknown) => {
				try {
					controller.enqueue(encoder.encode(sse(event, data)));
				} catch {
					// klien sudah menutup koneksi
				}
			};
			// Komentar SSE berkala menjaga koneksi browser tetap hidup selama model berpikir.
			const keepAlive = setInterval(() => send('ping', {}), 15_000);
			let features = 0;
			let ok = false;
			try {
				const draft = await generateDraft(input, config, {
					userText,
					// Saat PM menekan Batal (koneksi ditutup), permintaan ke AI ikut dihentikan.
					signal: request.signal,
					onProgress: (p) => send('progress', p)
				});
				const result = anonymized ? restoreNames(draft, names) : draft;
				features = result.features.length;
				ok = true;
				send('done', result);
			} catch (e) {
				send('error', { message: e instanceof AiDraftError ? e.message : 'Terjadi kesalahan saat menyusun draf.' });
				if (!(e instanceof AiDraftError)) console.error('AI draft gagal', e);
			} finally {
				busy = false;
				clearInterval(keepAlive);
				logAiCall(db, { provider: aiProvider(config), model: config.model, chars, anonymized, ok, features });
				try {
					controller.close();
				} catch {
					// sudah ditutup
				}
			}
		}
	});

	return new Response(stream, {
		headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' }
	});
};
