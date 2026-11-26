// Draf estimasi dengan AI: kebutuhan prospek → daftar fitur dengan O/M/P per peran.
// Memakai endpoint chat completions yang kompatibel OpenAI (dikonfigurasi lewat .env).
// Yang dikirim hanya teks kebutuhan dan nama peran; rate, harga, dan kontak klien tidak pernah dikirim.
import * as v from 'valibot';
import type { DraftFeature } from '../validation/estimate.ts';

export interface AiConfig {
	apiKey: string;
	baseUrl: string;
	model: string;
}

export interface AiDraftInput {
	projectName: string;
	needs: string;
	businessGoal: string;
	/** Catatan tambahan dari PM (notulen rapat, RFP, dsb.). */
	notes: string;
	/** Peran yang boleh dipakai (dari snapshot estimasi). */
	roles: { id: number; name: string }[];
	/** Fitur yang sudah ada, agar AI tidak menduplikasi. */
	existingFeatures: string[];
}

export interface AiDraftResult {
	features: DraftFeature[];
	assumptions: string[];
	exclusions: string[];
	risks: string[];
}

export class AiDraftError extends Error {}

const MAX_FEATURES = 60;
const MAX_HOURS = 2000;
/** Jeda sebelum mencoba ulang koneksi yang gagal (maksimal 3 percobaan); dapat diubah untuk tes. */
let RETRY_DELAYS_MS = [2000, 5000];
export const setRetryDelays = (ms: number[]) => (RETRY_DELAYS_MS = ms);

const ResponseSchema = v.object({
	features: v.array(
		v.object({
			module: v.optional(v.string(), ''),
			name: v.string(),
			description: v.optional(v.string(), ''),
			priority: v.optional(v.string(), 'must'),
			assumptions: v.optional(v.string(), ''),
			efforts: v.optional(
				v.array(v.object({ roleId: v.number(), o: v.number(), m: v.number(), p: v.number() })),
				[]
			)
		})
	),
	assumptions: v.optional(v.array(v.string()), []),
	exclusions: v.optional(v.array(v.string()), []),
	risks: v.optional(v.array(v.string()), [])
});

export function buildMessages(input: AiDraftInput) {
	const roleList = input.roles.map((r) => `- ${r.id}: ${r.name}`).join('\n');
	const system = `Kamu adalah project manager software senior di Indonesia yang menyusun estimasi pra-proyek.
Pecah kebutuhan menjadi fitur yang dapat diestimasi, lalu beri estimasi tiga titik (PERT) dalam JAM per peran.

Aturan:
- Gunakan hanya peran dari daftar yang diberikan, dirujuk dengan roleId (angka). Jangan mengarang peran lain.
- Peran manajemen seperti PM tidak diberi effort per fitur; PM dialokasikan terpisah.
- Untuk setiap peran yang terlibat: o = optimis, m = paling mungkin, p = pesimis, dalam jam, dengan 0 ≤ o ≤ m ≤ p.
- Lebar rentang mencerminkan ketidakpastian: fitur yang kabur atau bergantung pihak ketiga diberi rentang lebih lebar.
- Kelompokkan fitur ke modul (misalnya Autentikasi, Transaksi, Laporan). Nama fitur singkat dalam bahasa Indonesia.
- priority: "must" untuk inti, "should" untuk penting tetapi bisa ditunda, "could" untuk tambahan.
- Sertakan pekerjaan yang sering terlupa bila relevan (setup proyek, integrasi, migrasi data, testing) sebagai fitur tersendiri.
- assumptions, exclusions, risks: kalimat pendek dalam bahasa Indonesia, maksimal 6 butir masing-masing; risiko terpenting di urutan pertama.
- Maksimal ${MAX_FEATURES} fitur.
- Ringkas: isi "description" dan "assumptions" per fitur hanya bila benar-benar perlu (selain itu string kosong). Tulis JSON tanpa spasi atau indentasi.

Jawab HANYA dengan JSON valid berbentuk:
{"features":[{"module":"string","name":"string","description":"string","priority":"must|should|could","assumptions":"string","efforts":[{"roleId":1,"o":4,"m":6,"p":10}]}],"assumptions":["string"],"exclusions":["string"],"risks":["string"]}`;

	const user = [
		`Nama proyek: ${input.projectName}`,
		`Peran yang tersedia (roleId: nama):\n${roleList}`,
		input.needs.trim() && `Ringkasan kebutuhan:\n${input.needs.trim()}`,
		input.businessGoal.trim() && `Tujuan bisnis:\n${input.businessGoal.trim()}`,
		input.notes.trim() && `Catatan tambahan dari PM:\n${input.notes.trim()}`,
		input.existingFeatures.length > 0 &&
			`Fitur yang sudah ada di estimasi (jangan diulang):\n${input.existingFeatures.map((f) => `- ${f}`).join('\n')}`
	]
		.filter(Boolean)
		.join('\n\n');

	return [
		{ role: 'system' as const, content: system },
		{ role: 'user' as const, content: user }
	];
}

/** Mengambil objek JSON dari teks jawaban model (bisa terbungkus ```json ... ```). */
export function extractJson(text: string): unknown {
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
	const body = (fenced ? fenced[1] : text).trim();
	const start = body.indexOf('{');
	const end = body.lastIndexOf('}');
	if (start < 0 || end <= start) throw new AiDraftError('Jawaban AI tidak berisi JSON.');
	try {
		return JSON.parse(body.slice(start, end + 1));
	} catch {
		throw new AiDraftError('Jawaban AI bukan JSON yang valid.');
	}
}

const clampHours = (n: number) => (Number.isFinite(n) ? Math.min(MAX_HOURS, Math.max(0, Math.round(n * 2) / 2)) : 0);
const cleanList = (items: string[]) => items.map((s) => s.trim()).filter(Boolean).slice(0, 10);
const text = (s: string, max: number) => s.trim().slice(0, max);

/** Memvalidasi dan merapikan jawaban model agar aman dimasukkan ke estimasi. */
export function normalizeDraft(raw: unknown, roleIds: number[]): AiDraftResult {
	const parsed = v.safeParse(ResponseSchema, raw);
	if (!parsed.success) throw new AiDraftError('Format jawaban AI tidak sesuai. Coba lagi.');
	const allowed = new Set(roleIds);

	const features: DraftFeature[] = parsed.output.features
		.filter((f) => f.name.trim())
		.slice(0, MAX_FEATURES)
		.map((f) => {
			const efforts: DraftFeature['efforts'] = {};
			for (const e of f.efforts) {
				if (!allowed.has(e.roleId)) continue;
				const [o, m, p] = [e.o, e.m, e.p].map(clampHours).sort((a, b) => a - b);
				if (p > 0) efforts[e.roleId] = { o, m, p };
			}
			const priority = (['must', 'should', 'could'] as const).find((x) => x === f.priority.toLowerCase()) ?? 'must';
			return {
				module: text(f.module, 80),
				name: text(f.name, 160),
				description: text(f.description, 2000),
				priority,
				assumptions: text(f.assumptions, 2000),
				efforts
			};
		});

	if (features.length === 0) throw new AiDraftError('AI tidak menghasilkan fitur. Tambahkan detail kebutuhan lalu coba lagi.');
	return {
		features,
		assumptions: cleanList(parsed.output.assumptions),
		exclusions: cleanList(parsed.output.exclusions),
		risks: cleanList(parsed.output.risks)
	};
}

/** Progres selama AI menulis: jumlah fitur yang sudah muncul di jawaban. */
export type DraftProgress = (p: { features: number; chars: number }) => void;

/** Membaca aliran SSE kompatibel OpenAI dan menggabungkan potongan teks jawaban. */
async function readStream(
	res: Response,
	onProgress?: DraftProgress
): Promise<{ content: string; finishReason?: string; streamError?: string }> {
	if (!res.body) throw new AiDraftError('Jawaban AI kosong. Coba lagi.');
	const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
	let buffer = '';
	let content = '';
	let finishReason: string | undefined;
	let streamError: string | undefined;
	let features = 0;
	for (;;) {
		const { value, done } = await reader.read();
		if (done) break;
		buffer += value;
		const lines = buffer.split('\n');
		buffer = lines.pop() ?? '';
		for (const line of lines) {
			const data = line.startsWith('data:') ? line.slice(5).trim() : '';
			if (!data || data === '[DONE]') continue;
			let chunk: {
				choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
				error?: { message?: string; code?: string };
			};
			try {
				chunk = JSON.parse(data);
			} catch {
				continue; // baris keep-alive atau potongan tidak lengkap
			}
			// Sebagian router mengirim error di dalam aliran (HTTP tetap 200), kadang setelah jawaban lengkap.
			if (chunk.error) streamError = chunk.error.message ?? chunk.error.code ?? 'error tidak dikenal';
			const choice = chunk.choices?.[0];
			if (choice?.finish_reason) finishReason = choice.finish_reason;
			const piece = choice?.delta?.content;
			if (!piece) continue;
			content += piece;
			const count = (content.match(/"name"\s*:/g) ?? []).length;
			if (count !== features || content.length % 2000 < piece.length) {
				features = count;
				onProgress?.({ features, chars: content.length });
			}
		}
	}
	return { content, finishReason, streamError };
}

export async function generateDraft(
	input: AiDraftInput,
	config: AiConfig,
	opts: { signal?: AbortSignal; onProgress?: DraftProgress } = {}
): Promise<AiDraftResult> {
	// Model penalaran bisa butuh beberapa menit untuk estimasi besar; batas total 10 menit.
	const signal = AbortSignal.any([opts.signal ?? new AbortController().signal, AbortSignal.timeout(600_000)]);
	const request = () =>
		fetch(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model: config.model,
				messages: buildMessages(input),
				response_format: { type: 'json_object' },
				temperature: 0.2,
				max_tokens: 12000,
				stream: true
			}),
			signal
		});

	/** Gagal tersambung (DNS, koneksi putus) belum ditagih, jadi dicoba ulang dengan jeda bertambah. */
	async function connect(): Promise<Response> {
		for (let attempt = 0; ; attempt++) {
			try {
				return await request();
			} catch (e) {
				if (signal.aborted || attempt >= RETRY_DELAYS_MS.length) throw abortError(e, opts.signal);
				console.warn(`AI: koneksi gagal (${describeNetworkError(e)}), mencoba ulang`);
				await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
			}
		}
	}

	// Layanan kadang mengirim error di tengah jawaban; jawaban tidak utuh diminta ulang sekali.
	for (let attempt = 1; ; attempt++) {
		const res = await connect();
		if (!res.ok) {
			const status = res.status;
			throw new AiDraftError(
				status === 401 || status === 403
					? 'API key AI ditolak. Periksa AI_API_KEY di .env.'
					: status === 404
						? 'Model atau endpoint AI tidak ditemukan. Periksa MODEL dan AI_BASE_URL di .env.'
						: status === 429
							? 'Batas pemakaian AI tercapai. Coba beberapa saat lagi.'
							: `Layanan AI mengembalikan error (${status}).`
			);
		}

		let result: Awaited<ReturnType<typeof readStream>>;
		try {
			result = await readStream(res, opts.onProgress);
		} catch (e) {
			throw abortError(e, opts.signal);
		}
		if (result.finishReason === 'length')
			throw new AiDraftError('Jawaban AI terpotong karena terlalu panjang. Persempit kebutuhan lalu coba lagi.');

		const upstream = result.streamError ? `Layanan AI mengirim error: ${result.streamError} Coba lagi.` : null;
		try {
			if (!result.content) throw new AiDraftError('Jawaban AI kosong. Coba lagi.');
			return normalizeDraft(extractJson(result.content), input.roles.map((r) => r.id));
		} catch (e) {
			// Bila error di tengah aliran membuat jawaban tidak utuh: minta ulang sekali, lalu tampilkan error aslinya.
			if (upstream && e instanceof AiDraftError) {
				if (attempt < 2 && !signal.aborted) {
					console.warn(`AI: layanan mengirim error di tengah jawaban (${result.streamError}), meminta ulang`);
					continue;
				}
				throw new AiDraftError(upstream);
			}
			throw e;
		}
	}
}

/** Kode penyebab error jaringan dari fetch Node (mis. ECONNRESET, ENOTFOUND, UND_ERR_CONNECT_TIMEOUT). */
function describeNetworkError(e: unknown): string {
	const cause = e instanceof Error ? (e.cause as { code?: string; message?: string; hostname?: string } | undefined) : undefined;
	const reason = cause?.code ?? cause?.message ?? (e instanceof Error ? e.message : String(e));
	// Nama host membantu membedakan salah ketik URL dari gangguan DNS.
	return cause?.hostname ? `${reason} ${cause.hostname}` : reason;
}

function abortError(e: unknown, userSignal?: AbortSignal): AiDraftError {
	if (e instanceof AiDraftError) return e;
	if (userSignal?.aborted) return new AiDraftError('Dibatalkan.');
	const name = e instanceof Error ? e.name : '';
	if (name === 'TimeoutError' || name === 'AbortError') return new AiDraftError('AI terlalu lama menjawab (lebih dari 10 menit). Coba lagi.');
	const detail = describeNetworkError(e);
	console.error('AI: tidak dapat terhubung', detail, e);
	return new AiDraftError(`Tidak dapat terhubung ke layanan AI (${detail}). Periksa koneksi internet atau AI_BASE_URL, lalu coba lagi.`);
}
