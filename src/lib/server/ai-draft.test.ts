import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiDraftError, anonymize, buildMessages, buildUserText, extractJson, generateDraft, normalizeDraft, restoreNames, setIdleTimeout, setRetryDelays } from './ai-draft.ts';

setRetryDelays([0, 0]);

const input = {
	projectName: 'Aplikasi Kasir',
	needs: 'Kasir untuk 12 cabang',
	businessGoal: '',
	notes: 'Harus bisa QRIS',
	roles: [
		{ id: 2, name: 'Frontend' },
		{ id: 3, name: 'Backend · Senior' }
	],
	existingFeatures: ['Login']
};
const config = { apiKey: 'k', baseUrl: 'https://example.test/v1/', model: 'm' };

describe('prompt', () => {
	it('berisi peran dan kebutuhan, tanpa rate atau harga', () => {
		const [system, user] = buildMessages(input);
		expect(system.content).toContain('JSON');
		expect(user.content).toContain('3: Backend · Senior');
		expect(user.content).toContain('Harus bisa QRIS');
		expect(user.content).toContain('- Login');
		expect(user.content).not.toMatch(/Rp|rate/i);
		expect(user.content).not.toContain('Tujuan bisnis'); // bagian kosong tidak dikirim
	});
});

describe('membaca jawaban', () => {
	it('mengambil JSON dari blok kode', () => {
		expect(extractJson('Berikut:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
		expect(() => extractJson('maaf')).toThrow(AiDraftError);
	});

	it('merapikan: peran asing dibuang, O/M/P diurutkan, jam dibulatkan, prioritas dinormalkan', () => {
		const r = normalizeDraft(
			{
				features: [
					{
						module: 'Transaksi',
						name: ' Kasir ',
						priority: 'MUST',
						efforts: [
							{ roleId: 3, o: 60, m: 40, p: 100.3 },
							{ roleId: 99, o: 1, m: 2, p: 3 },
							{ roleId: 2, o: 0, m: 0, p: 0 }
						]
					},
					{ name: '', efforts: [] },
					{ name: 'Laporan', priority: 'nanti', efforts: [{ roleId: 2, o: -5, m: 8, p: 99999 }] }
				],
				risks: [' Sandbox bank tidak stabil ', '']
			},
			[2, 3]
		);
		expect(r.features).toEqual([
			{ module: 'Transaksi', name: 'Kasir', description: '', priority: 'must', assumptions: '', efforts: { 3: { o: 40, m: 60, p: 100.5 } } },
			{ module: '', name: 'Laporan', description: '', priority: 'must', assumptions: '', efforts: { 2: { o: 0, m: 8, p: 2000 } } }
		]);
		expect(r.risks).toEqual(['Sandbox bank tidak stabil']);
	});

	it('menolak jawaban tanpa fitur atau berbentuk salah', () => {
		expect(() => normalizeDraft({ features: [] }, [1])).toThrow(/tidak menghasilkan fitur/);
		expect(() => normalizeDraft({ fitur: [] }, [1])).toThrow(/Format/);
	});
});

describe('memanggil layanan', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	const reply = (status: number, body: unknown) =>
		vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })));

	/** Jawaban SSE dipotong-potong di tengah baris, seperti aliran jaringan sungguhan. */
	const stream = (pieces: string[], finish = 'stop') => {
		const sse =
			pieces.map((p) => `data: ${JSON.stringify({ choices: [{ delta: { content: p } }] })}\n\n`).join('') +
			`: keep-alive\n\ndata: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: finish }] })}\n\ndata: [DONE]\n\n`;
		const bytes = new TextEncoder().encode(sse);
		const body = new ReadableStream({
			start(c) {
				for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7));
				c.close();
			}
		});
		vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })));
	};

	it('mengalirkan jawaban dari /chat/completions, melaporkan progres, mengembalikan draf', async () => {
		stream(['{"features":[{"name":"Kasir","efforts":[{"roleId":3,"o":4,"m":6,"p":10}]},', '{"name":"Laporan","efforts":[]}]}']);
		const progress: number[] = [];
		const r = await generateDraft(input, config, { onProgress: (p) => progress.push(p.features) });
		expect(r.features.map((f) => f.name)).toEqual(['Kasir', 'Laporan']);
		expect(r.features[0].efforts).toEqual({ 3: { o: 4, m: 6, p: 10 } });
		expect(progress.at(-1)).toBe(2);
		const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(url).toBe('https://example.test/v1/chat/completions');
		expect(JSON.parse(init.body)).toMatchObject({ model: 'm', stream: true });
		expect(init.headers.Authorization).toBe('Bearer k');
	});

	it('pesan error yang jelas', async () => {
		reply(401, {});
		await expect(generateDraft(input, config)).rejects.toThrow(/API key AI ditolak/);
		reply(404, {});
		await expect(generateDraft(input, config)).rejects.toThrow(/Periksa MODEL/);
		stream(['{"features":['], 'length');
		await expect(generateDraft(input, config)).rejects.toThrow(/terpotong/);
	});

	const networkError = (code: string) => Object.assign(new TypeError('fetch failed'), { cause: { code, hostname: 'api.contoh.test' } });
	const okStream = () => {
		const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: '{"features":[{"name":"Kasir","efforts":[]}]}' } }] })}\n\ndata: [DONE]\n\n`;
		return new Response(sse, { status: 200 });
	};

	const sseBody = (lines: unknown[]) =>
		new Response(lines.map((l) => `data: ${JSON.stringify(l)}\n\n`).join('') + 'data: [DONE]\n\n', { status: 200 });

	it('error di akhir aliran diabaikan bila jawaban sudah utuh (perilaku routr.cloud)', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => sseBody([
			{ choices: [{ delta: { content: '```json\n{"features":[{"name":"Kasir","efforts":[]}]}\n```' } }] },
			{ error: { type: 'api_error', code: 'upstream_error', message: 'An upstream error occurred while processing your request.' } }
		])));
		const r = await generateDraft(input, config);
		expect(r.features[0].name).toBe('Kasir');
	});

	const brokenStream = () =>
		sseBody([
			{ choices: [{ delta: { content: '{"features":[{"name":"Kas' } }] },
			{ error: { code: 'upstream_error', message: 'An upstream error occurred while processing your request.' } }
		]);

	it('jawaban terpotong error di tengah aliran diminta ulang sekali, lalu berhasil', async () => {
		const fetchMock = vi.fn()
			.mockResolvedValueOnce(brokenStream())
			.mockResolvedValueOnce(sseBody([{ choices: [{ delta: { content: '{"features":[{"name":"Kasir","efforts":[]}]}' } }] }]));
		vi.stubGlobal('fetch', fetchMock);
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect((await generateDraft(input, config)).features[0].name).toBe('Kasir');
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('error di tengah aliran dua kali: pesan error aslinya ditampilkan', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => brokenStream()));
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		await expect(generateDraft(input, config)).rejects.toThrow('Layanan AI mengirim error: An upstream error occurred');
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('koneksi gagal sekali lalu dicoba ulang otomatis', async () => {
		const fetchMock = vi.fn().mockRejectedValueOnce(networkError('ECONNRESET')).mockResolvedValueOnce(okStream());
		vi.stubGlobal('fetch', fetchMock);
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const r = await generateDraft(input, config);
		expect(r.features[0].name).toBe('Kasir');
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('DNS gagal dua kali lalu pulih pada percobaan ketiga', async () => {
		const fetchMock = vi.fn()
			.mockRejectedValueOnce(networkError('ENOTFOUND'))
			.mockRejectedValueOnce(networkError('ENOTFOUND'))
			.mockResolvedValueOnce(okStream());
		vi.stubGlobal('fetch', fetchMock);
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect((await generateDraft(input, config)).features[0].name).toBe('Kasir');
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it('gagal tiga kali: pesan menyebut penyebabnya', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkError('ENOTFOUND')));
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.spyOn(console, 'error').mockImplementation(() => {});
		await expect(generateDraft(input, config)).rejects.toThrow('Tidak dapat terhubung ke layanan AI (ENOTFOUND api.contoh.test)');
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it('dibatalkan pengguna', async () => {
		vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => {
			await new Promise((_, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('x', 'AbortError'))));
			return new Response('');
		}));
		const c = new AbortController();
		const pending = generateDraft(input, config, { signal: c.signal });
		c.abort();
		await expect(pending).rejects.toThrow('Dibatalkan.');
	});
});

describe('privasi', () => {
	const names = { project: 'Aplikasi Kasir Toko Maju', client: 'Toko Maju' };

	it('menyamarkan nama proyek dan klien (terpanjang dulu, tanpa peduli huruf besar)', () => {
		expect(anonymize('Proyek Aplikasi Kasir Toko Maju untuk TOKO MAJU (cabang toko maju)', names)).toBe('Proyek [Proyek] untuk [Klien] (cabang [Klien])');
		expect(anonymize('Toko (Maju)?', { project: 'X', client: 'Toko (Maju)?' })).toBe('[Klien]');
		expect(anonymize('PT A', { project: '', client: 'A' })).toBe('PT A'); // nama terlalu pendek tidak disamarkan
	});

	it('mengembalikan nama asli di hasil AI', () => {
		const r = restoreNames(
			{ features: [{ module: '[Klien]', name: 'Laporan [Proyek]', description: '', priority: 'must', assumptions: 'Data dari [Klien]', efforts: {} }], assumptions: ['[Klien] menyediakan API'], exclusions: [], risks: [] },
			names
		);
		expect(r.features[0]).toMatchObject({ module: 'Toko Maju', name: 'Laporan Aplikasi Kasir Toko Maju', assumptions: 'Data dari Toko Maju' });
		expect(r.assumptions).toEqual(['Toko Maju menyediakan API']);
	});

	it('teks pratinjau yang diedit PM dikirim apa adanya; tanpa rate atau harga', async () => {
		const text = buildUserText(input);
		expect(text).toContain('Harus bisa QRIS');
		expect(text).not.toMatch(/rate|harga|Rp/i);
		const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: '{"features":[{"name":"Kasir","efforts":[]}]}' } }] })}\n\ndata: [DONE]\n\n`;
		vi.stubGlobal('fetch', vi.fn(async () => new Response(sse, { status: 200 })));
		await generateDraft(input, config, { userText: 'Teks yang sudah diedit PM' });
		const body = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
		expect(body.messages[1]).toEqual({ role: 'user', content: 'Teks yang sudah diedit PM' });
		vi.unstubAllGlobals();
	});

	it('berhenti bila AI diam lebih dari batas waktu, tanpa mencoba ulang', async () => {
		setIdleTimeout(50);
		const fetchMock = vi.fn(async () => new Response(new ReadableStream({ start() {} }), { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);
		await expect(generateDraft(input, config)).rejects.toThrow(/tidak merespons dalam 0 detik/);
		vi.stubGlobal('fetch', vi.fn((_u: string, init: RequestInit) => new Promise((_, reject) => init.signal!.addEventListener('abort', () => reject(init.signal!.reason)))));
		await expect(generateDraft(input, config)).rejects.toThrow(/tidak merespons/);
		expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
		setIdleTimeout(30_000);
		vi.unstubAllGlobals();
	});
});
