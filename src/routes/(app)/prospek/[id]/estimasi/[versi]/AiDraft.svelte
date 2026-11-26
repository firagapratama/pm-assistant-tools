<script lang="ts">
	// Draf fitur dengan AI: PM meninjau pratinjau dan memilih fitur sebelum masuk ke estimasi.
	import { page } from '$app/state';
	import { LoaderCircle, Sparkles, X } from '@lucide/svelte';
	import { pertE } from '#lib/calc/pert.ts';
	import { toast } from '#lib/components/toast.svelte.ts';
	import { decimal } from '#lib/format/index.ts';
	import type { DraftFeature } from '#lib/validation/estimate.ts';
	import type { EstimateEditor } from './editor.svelte.ts';

	interface Draft {
		features: DraftFeature[];
		assumptions: string[];
		exclusions: string[];
		risks: string[];
	}

	let {
		ed,
		ai,
		needs,
		prospectId,
		label = 'Buat draf dengan AI'
	}: { ed: EstimateEditor; ai: { model: string } | null; needs: string; prospectId: number; label?: string } = $props();

	let open = $state(false);
	let notes = $state('');
	let loading = $state(false);
	let elapsed = $state(0);
	let error = $state('');
	let draft = $state<Draft | null>(null);
	let chosen: boolean[] = $state([]);
	let includeNotes = $state(true);
	let controller: AbortController | null = null;
	/** Pratinjau teks persis yang akan dikirim; PM boleh mengeditnya (PRD F4). */
	let anonymizeNames = $state(true);
	let preview: { text: string; provider: string; model: string } | null = $state(null);
	let previewing = $state(false);

	async function loadPreview() {
		previewing = true;
		error = '';
		try {
			const res = await fetch(`${page.url.pathname}/ai-draft`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'preview', notes, anonymize: anonymizeNames })
			});
			const data = await res.json();
			if (!res.ok) error = data.message ?? 'Pratinjau gagal dibuat.';
			else preview = data;
		} catch {
			error = 'Tidak dapat menghubungi server.';
		} finally {
			previewing = false;
		}
	}

	let progress = $state(0);

	/** Membaca aliran SSE dari endpoint draf AI: progress → done | error. */
	async function generate() {
		loading = true;
		error = '';
		draft = null;
		elapsed = 0;
		progress = 0;
		const timer = setInterval(() => elapsed++, 1000);
		controller = new AbortController();
		try {
			const res = await fetch(`${page.url.pathname}/ai-draft`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'generate', text: preview?.text ?? '', anonymize: anonymizeNames }),
				signal: controller.signal
			});
			if (!res.ok || !res.body) throw new Error(String(res.status));
			const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
			let buffer = '';
			for (;;) {
				const { value, done } = await reader.read();
				if (done) break;
				buffer += value;
				const events = buffer.split('\n\n');
				buffer = events.pop() ?? '';
				for (const block of events) {
					const event = block.match(/^event: (.*)$/m)?.[1];
					const data = block.match(/^data: (.*)$/m)?.[1];
					if (!event || !data) continue;
					const payload = JSON.parse(data);
					if (event === 'progress') progress = payload.features;
					else if (event === 'error') error = payload.message;
					else if (event === 'done') {
						draft = payload as Draft;
						chosen = draft.features.map(() => true);
					}
				}
			}
			if (!draft && !error) error = 'Koneksi terputus sebelum draf selesai. Coba lagi.';
		} catch (e) {
			if (!(e instanceof DOMException && e.name === 'AbortError')) error = 'Tidak dapat menghubungi server.';
		} finally {
			clearInterval(timer);
			loading = false;
			controller = null;
		}
	}

	function cancel() {
		controller?.abort();
		open = false;
		preview = null;
	}

	const totalE = (f: DraftFeature) => Object.values(f.efforts).reduce((a, t) => a + pertE(t), 0);
	let picked = $derived(draft ? draft.features.filter((_, i) => chosen[i]) : []);
	let pickedHours = $derived(picked.reduce((a, f) => a + totalE(f), 0));
	let modules = $derived.by(() => {
		const groups = new Map<string, { f: DraftFeature; i: number }[]>();
		draft?.features.forEach((f, i) => {
			const key = f.module || 'Lainnya';
			groups.set(key, [...(groups.get(key) ?? []), { f, i }]);
		});
		return [...groups];
	});
	const roleShort = (id: number) => ed.roleName(id).split(' · ')[0];

	function apply(mode: 'append' | 'replace') {
		if (!draft || picked.length === 0) return;
		// Masuk sebagai "draf AI": wajib ditinjau sebelum estimasi bisa final.
		const undo = ed.applyDraft(picked.map((f) => ({ ...f, aiDraft: true })), mode, includeNotes ? draft : undefined);
		toast(`${picked.length} fitur dari draf AI ${mode === 'replace' ? 'menggantikan fitur lama' : 'ditambahkan'}. Periksa angkanya.`, 'info', {
			label: 'Urungkan',
			run: undo
		});
		open = false;
		draft = null;
		preview = null;
		notes = '';
	}
</script>

{#if !ai}
	<!-- Draf AI dimatikan di Pengaturan atau belum dikonfigurasi: tombol tidak ditampilkan (PRD F4). -->
{:else if !open}
	<button class="btn" onclick={() => (open = true)} disabled={ed.locked}>
		<Sparkles size={16} strokeWidth={1.75} aria-hidden="true" /> {label}
	</button>
{:else}
	<section class="panel ai" aria-labelledby="ai-judul">
		<div class="panel-kepala">
			<h3 id="ai-judul"><Sparkles size={16} strokeWidth={1.75} aria-hidden="true" /> Draf fitur dengan AI</h3>
			<button class="btn teks kecil" aria-label="Tutup" onclick={cancel}><X size={16} strokeWidth={1.75} /></button>
		</div>

		{#if !draft && !preview}
			<div class="panel-isi isi">
				<div class="sumber">
					<span class="field-label">Ringkasan kebutuhan dari prospek</span>
					{#if needs.trim()}
						<p class="kutipan">{needs.length > 400 ? needs.slice(0, 400) + '…' : needs}</p>
					{:else}
						<p class="field-hint">Belum diisi. <a href="/prospek/{prospectId}">Isi di halaman prospek</a>, atau tulis kebutuhannya di bawah.</p>
					{/if}
				</div>
				<label class="field">
					<span class="field-label">Catatan tambahan <span class="opsional">· opsional</span></span>
					<textarea
						rows="5"
						bind:value={notes}
						disabled={previewing}
						placeholder="Tempel notulen rapat, isi RFP, daftar layar, integrasi yang diminta, batasan teknis…"
					></textarea>
				</label>
				<label class="catatan">
					<input type="checkbox" bind:checked={anonymizeNames} />
					Samarkan nama klien dan proyek (diganti [Klien] dan [Proyek], dikembalikan di hasil)
				</label>
				{#if error}<p class="pesan-error" role="alert">{error}</p>{/if}
				<div class="aksi">
					<button class="btn teks" onclick={cancel}>Batal</button>
					<button class="btn" onclick={loadPreview} disabled={previewing}>{previewing ? 'Menyiapkan…' : 'Lihat teks yang akan dikirim'}</button>
				</div>
			</div>
		{:else if !draft && preview}
			<div class="panel-isi isi">
				<p class="field-hint">
					Dikirim ke: <strong>{preview.provider}</strong> · {preview.model}. Teks di bawah dikirim persis seperti ini, bersama aturan format
					jawaban. Rate, biaya, harga, dan kontak klien tidak pernah dikirim.
				</p>
				<label class="field">
					<span class="field-label">Teks yang dikirim <span class="opsional">· dapat diedit</span></span>
					<textarea class="pratinjau" rows="12" bind:value={preview.text} disabled={loading}></textarea>
				</label>
				{#if anonymizeNames}<p class="field-hint">Nama klien dan proyek disamarkan, juga bila diketik ulang di teks ini.</p>{/if}
				{#if error}<p class="pesan-error" role="alert">{error}</p>{/if}
				<div class="aksi">
					{#if loading}
						<span class="memuat" aria-live="polite">
							<LoaderCircle size={16} strokeWidth={2} class="putar" aria-hidden="true" />
							{progress > 0 ? `${progress} fitur tersusun` : 'Menyusun draf…'} · {elapsed} dtk
						</span>
						<button class="btn teks" onclick={() => controller?.abort()}>Batalkan</button>
					{:else}
						<button class="btn teks" onclick={() => (preview = null)}>Kembali</button>
						<button class="btn" onclick={generate} disabled={!preview.text.trim()}>{error ? 'Coba lagi' : 'Kirim ke AI'}</button>
					{/if}
				</div>
			</div>
		{:else if draft}
			<div class="panel-isi isi">
				<p class="ringkas">
					{draft.features.length} fitur diusulkan. Pilih yang ingin dipakai; semua angka tetap bisa diubah setelahnya.
				</p>
				<div class="daftar">
					{#each modules as [name, items] (name)}
						<div class="modul">
							<span class="nama-modul">{name}</span>
							{#each items as { f, i } (i)}
								<label class="fitur">
									<input type="checkbox" bind:checked={chosen[i]} />
									<span class="isi-fitur">
										<span class="judul-fitur">
											{f.name}
											{#if f.priority !== 'must'}<span class="prioritas">{f.priority === 'should' ? 'Should' : 'Could'}</span>{/if}
										</span>
										<span class="peran">
											{Object.entries(f.efforts)
												.map(([id, t]) => `${roleShort(Number(id))} ${decimal(ed.toUnit(pertE(t)), 0)}`)
												.join(' · ') || 'tanpa effort'}
										</span>
									</span>
									<span class="angka jam">{decimal(ed.toUnit(totalE(f)), 0)} {ed.unitLabel}</span>
								</label>
							{/each}
						</div>
					{/each}
				</div>
				{#if draft.assumptions.length + draft.exclusions.length + draft.risks.length > 0}
					<label class="catatan">
						<input type="checkbox" bind:checked={includeNotes} />
						Tambahkan juga {draft.assumptions.length} asumsi, {draft.exclusions.length} hal tidak termasuk, dan {draft.risks.length} risiko
						ke tab Parameter
					</label>
				{/if}
				<div class="aksi">
					<span class="total">{picked.length} dipilih · {ed.effortText(pickedHours, 0)}</span>
					<button class="btn teks" onclick={() => (draft = null)}>Kembali ke teks</button>
					{#if ed.features.length > 0}
						<button class="btn" onclick={() => apply('replace')} disabled={picked.length === 0}>Ganti semua fitur</button>
					{/if}
					<button class="btn" onclick={() => apply('append')} disabled={picked.length === 0}>
						{ed.features.length > 0 ? 'Tambahkan ke estimasi' : 'Pakai draf ini'}
					</button>
				</div>
			</div>
		{/if}
	</section>
{/if}

<style>
	.ai {
		margin-bottom: var(--jarak-6);
	}
	.ai h3 {
		display: flex;
		align-items: center;
		gap: var(--jarak-2);
		font-size: var(--teks-isi);
	}
	.isi {
		display: grid;
		gap: var(--jarak-4);
	}
	.sumber {
		display: grid;
		gap: var(--jarak-1);
	}
	.pratinjau {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: var(--teks-kecil);
	}
	.kutipan {
		margin: 0;
		padding: var(--jarak-3) var(--jarak-4);
		border-left: 2px solid var(--garis-kuat);
		background: color-mix(in srgb, var(--kertas) 50%, var(--permukaan));
		color: var(--tinta-2);
		font-size: var(--teks-kecil);
		white-space: pre-line;
	}
	.aksi {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: var(--jarak-2);
		flex-wrap: wrap;
	}
	.memuat,
	.total {
		display: inline-flex;
		align-items: center;
		gap: var(--jarak-2);
		margin-right: auto;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.memuat :global(.putar) {
		animation: putar 1s linear infinite;
	}
	@keyframes putar {
		to {
			transform: rotate(360deg);
		}
	}
	.ringkas {
		margin: 0;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.daftar {
		display: grid;
		gap: var(--jarak-4);
		max-height: 420px;
		overflow: auto;
		padding-right: var(--jarak-2);
	}
	.nama-modul {
		display: block;
		margin-bottom: var(--jarak-1);
		font-size: var(--teks-kecil);
		font-weight: 600;
		color: var(--tinta-2);
	}
	.fitur {
		display: flex;
		align-items: flex-start;
		gap: var(--jarak-3);
		padding: var(--jarak-2) 0;
		border-bottom: 1px solid var(--garis);
		cursor: pointer;
	}
	.fitur input,
	.catatan input {
		margin-top: 3px;
		accent-color: var(--nila);
	}
	.isi-fitur {
		display: grid;
		flex: 1;
	}
	.judul-fitur {
		font-weight: 500;
	}
	.prioritas {
		margin-left: var(--jarak-2);
		padding: 0 6px;
		border: 1px solid var(--garis);
		border-radius: var(--radius-kecil);
		font-size: var(--teks-mini);
		color: var(--tinta-2);
	}
	.peran {
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.jam {
		white-space: nowrap;
		font-weight: 500;
	}
	.catatan {
		display: flex;
		align-items: flex-start;
		gap: var(--jarak-2);
		font-size: var(--teks-kecil);
		cursor: pointer;
	}
</style>
