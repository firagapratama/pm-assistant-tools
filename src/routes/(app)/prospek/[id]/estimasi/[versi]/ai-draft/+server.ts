// POST: draf fitur dengan AI, dialirkan sebagai Server-Sent Events (progress → done | error).
// Hasilnya tidak disimpan; editor menampilkan pratinjau dan PM memilih untuk memakainya.
import * as v from 'valibot';
import { roleLabel } from '#lib/labels.ts';
import { AiDraftError, generateDraft } from '#lib/server/ai-draft.ts';
import { aiConfig, loadEstimateOr404 } from '#lib/server/estimate-context.ts';
import type { RequestHandler } from './$types';

const BodySchema = v.object({ notes: v.optional(v.pipe(v.string(), v.maxLength(20_000)), '') });

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

function errorStream(message: string) {
	return new Response(sse('error', { message }), { headers: { 'Content-Type': 'text/event-stream' } });
}

export const POST: RequestHandler = async ({ params, request }) => {
	const { prospect, estimate } = loadEstimateOr404(params);
	if (estimate.isFinal) return errorStream('Estimasi final terkunci.');
	const config = aiConfig();
	if (!config) return errorStream('AI belum dikonfigurasi. Isi AI_API_KEY, AI_BASE_URL, dan MODEL di .env.');

	const body = v.safeParse(BodySchema, await request.json().catch(() => null));
	if (!body.success) return errorStream('Permintaan tidak valid.');
	const notes = body.output.notes;
	if (!prospect.needs.trim() && !notes.trim())
		return errorStream('Isi ringkasan kebutuhan prospek atau catatan tambahan terlebih dahulu.');

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
			// Komentar SSE berkala menjaga koneksi tetap hidup selama model berpikir.
			const keepAlive = setInterval(() => send('ping', {}), 15_000);
			try {
				const draft = await generateDraft(
					{
						projectName: prospect.name,
						needs: prospect.needs,
						businessGoal: prospect.businessGoal,
						notes,
						roles: estimate.rates.map((r) => ({ id: r.roleId, name: roleLabel(r) })),
						existingFeatures: estimate.draft.features.map((f) => f.name).filter(Boolean)
					},
					config,
					// Saat PM menekan Batal (koneksi ditutup), permintaan ke AI ikut dihentikan.
					{ signal: request.signal, onProgress: (p) => send('progress', p) }
				);
				send('done', draft);
			} catch (e) {
				send('error', { message: e instanceof AiDraftError ? e.message : 'Terjadi kesalahan saat menyusun draf.' });
				if (!(e instanceof AiDraftError)) console.error('AI draft gagal', e);
			} finally {
				clearInterval(keepAlive);
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
