<script lang="ts">
	import { deserialize } from '$app/forms';
	import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
	import { ArrowLeft, Check, CircleAlert, FileText, LoaderCircle } from '@lucide/svelte';
	import * as v from 'valibot';
	import { toast } from '#lib/components/toast.svelte.ts';
	import { date, decimal, rupiahShort } from '#lib/format/index.ts';
	import { EstimateDraftSchema } from '#lib/validation/estimate.ts';
	import CostTab from './CostTab.svelte';
	import { EstimateEditor } from './editor.svelte.ts';
	import FeaturesTab from './FeaturesTab.svelte';
	import ParamsTab from './ParamsTab.svelte';
	import Summary from './Summary.svelte';
	import ScenariosTab from './ScenariosTab.svelte';
	import TeamTab from './TeamTab.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally — komponen dibuat ulang per estimasi (lihat {#key} di +page).
	const ed = new EstimateEditor(data.estimate.draft, data.estimate.rates, data.estimate.holidays, data.estimate.isFinal);
	// Rate dan status final dapat berubah dari server (ambil rate terbaru, tandai final).
	$effect(() => {
		ed.rates = data.estimate.rates;
		ed.holidays = data.estimate.holidays;
		ed.locked = data.estimate.isFinal;
	});

	const TABS = [
		{ id: 'fitur', label: 'Fitur' },
		{ id: 'tim', label: 'Tim' },
		{ id: 'biaya', label: 'Biaya' },
		{ id: 'skenario', label: 'Skenario' },
		{ id: 'parameter', label: 'Parameter' }
	] as const;
	let tab: (typeof TABS)[number]['id'] = $state('fitur');

	// ── Simpan otomatis ──
	type SaveState = 'tersimpan' | 'belum' | 'menyimpan' | 'invalid' | 'gagal';
	let status: SaveState = $state('tersimpan');
	let saveError = $state('');
	let lastSaved = JSON.stringify(ed.draft);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let inflight: Promise<void> | null = null;

	const isValid = (json: string) => v.safeParse(EstimateDraftSchema, JSON.parse(json)).success;

	$effect(() => {
		if (ed.locked) return;
		const json = JSON.stringify(ed.draft);
		clearTimeout(timer);
		if (json === lastSaved) {
			if (!inflight) status = 'tersimpan';
			return;
		}
		if (!isValid(json)) {
			status = 'invalid';
			return;
		}
		status = 'belum';
		timer = setTimeout(() => save(json), 800);
	});

	async function save(json: string) {
		if (inflight) await inflight;
		if (json === lastSaved) return;
		status = 'menyimpan';
		inflight = (async () => {
			try {
				const body = new FormData();
				body.set('payload', json);
				const res = await fetch('?/save', { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
				const result = deserialize(await res.text());
				if (result.type === 'success') {
					lastSaved = json;
					status = JSON.stringify(ed.draft) === json ? 'tersimpan' : 'belum';
				} else {
					status = 'gagal';
					saveError =
						result.type === 'failure' && typeof result.data?.message === 'string'
							? result.data.message
							: 'Periksa koneksi lalu coba lagi.';
				}
			} catch {
				status = 'gagal';
				saveError = 'Periksa koneksi lalu coba lagi.';
			}
		})();
		await inflight;
		inflight = null;
	}

	/** Menyimpan perubahan yang tertunda sekarang juga. true bila semua sudah tersimpan. */
	async function flush(): Promise<boolean> {
		clearTimeout(timer);
		const json = JSON.stringify(ed.draft);
		if (json !== lastSaved) {
			if (!isValid(json)) return false;
			await save(json);
		}
		if (inflight) await inflight;
		return JSON.stringify(ed.draft) === lastSaved;
	}

	beforeNavigate(() => {
		if (status === 'belum') save(JSON.stringify(ed.draft));
	});

	$effect(() => {
		const warn = (e: BeforeUnloadEvent) => {
			if (status === 'belum' || status === 'menyimpan' || status === 'invalid') e.preventDefault();
		};
		addEventListener('beforeunload', warn);
		return () => removeEventListener('beforeunload', warn);
	});

	// ── Aksi server ──
	let finalizing = $state(false);

	async function runAction(name: 'refreshRates' | 'finalize') {
		if (!(await flush())) {
			toast('Perbaiki isian yang belum valid terlebih dahulu.', 'error');
			return;
		}
		const res = await fetch(`?/${name}`, { method: 'POST', body: new FormData(), headers: { 'x-sveltekit-action': 'true' } });
		const result = deserialize(await res.text());
		if (result.type === 'success') {
			if (typeof result.data?.message === 'string') toast(result.data.message);
			await invalidateAll();
		} else if (result.type === 'failure') {
			toast(String(result.data?.message ?? 'Gagal.'), 'error');
		} else {
			toast('Terjadi kesalahan. Muat ulang halaman lalu coba lagi.', 'error');
		}
	}

	/** Ringkasan direksi dibaca dari server, jadi simpan perubahan tertunda lebih dulu. */
	async function openSummary(e: MouseEvent) {
		e.preventDefault();
		if (!ed.locked && !(await flush())) {
			toast('Perbaiki isian yang belum valid sebelum membuka ringkasan.', 'error');
			return;
		}
		goto(`/cetak/${data.estimate.id}`);
	}

	async function finalize() {
		finalizing = true;
		await runAction('finalize');
		finalizing = false;
	}

	let r = $derived(ed.result);
	let p = $derived(data.prospect);
</script>

<div class="kepala">
	<a class="kembali" href="/prospek/{p.id}"><ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" /> {p.name}</a>
	<div class="judul-baris">
		<div class="judul">
			<h1>Estimasi v{data.estimate.version}</h1>
			{#if ed.locked}<span class="badge final">Final</span>{:else}<span class="badge draft">Draft</span>{/if}
			{#if ed.locked && p.status !== 'deal'}
				<!-- Versi final terkunci; revisi lewat versi baru (PRD F7, design.md 6.12). -->
				<form method="POST" action="/prospek/{p.id}?/createEstimate"><button class="btn kecil">Buat versi baru</button></form>
			{/if}
		</div>
		<div class="kanan">
			<p class="simpan" class:waspada={status === 'invalid'} class:kritis={status === 'gagal'} aria-live="polite">
				{#if ed.locked}
					Terkunci sejak {data.estimate.finalizedAt ? date(data.estimate.finalizedAt) : ''}
				{:else if status === 'tersimpan'}
					<Check size={14} strokeWidth={2} aria-hidden="true" /> Tersimpan otomatis
				{:else if status === 'menyimpan' || status === 'belum'}
					<LoaderCircle size={14} strokeWidth={2} class="putar" aria-hidden="true" /> Menyimpan…
				{:else if status === 'invalid'}
					<CircleAlert size={14} strokeWidth={2} aria-hidden="true" /> Ada isian belum valid, belum disimpan
				{:else}
					<CircleAlert size={14} strokeWidth={2} aria-hidden="true" /> Gagal menyimpan. {saveError}
					<button class="btn teks kecil" onclick={() => save(JSON.stringify(ed.draft))}>Coba lagi</button>
				{/if}
			</p>
			<a class="btn kecil" href="/cetak/{data.estimate.id}" onclick={openSummary}>
				<FileText size={14} strokeWidth={1.75} aria-hidden="true" /> Ringkasan direksi
			</a>
		</div>
	</div>
	<p class="meta">{[p.client, `Dibuat ${date(data.estimate.createdAt)}`].filter(Boolean).join(' · ')}</p>
</div>

<div class="tata" class:terkunci={ed.locked}>
	<div class="kerja">
		<div class="tab" role="tablist" aria-label="Bagian estimasi">
			{#each TABS as t (t.id)}
				<button
					role="tab"
					id="tab-{t.id}"
					aria-selected={tab === t.id}
					aria-controls="panel-{t.id}"
					tabindex={tab === t.id ? 0 : -1}
					onclick={() => (tab = t.id)}
					onkeydown={(e) => {
						const i = TABS.findIndex((x) => x.id === tab);
						const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : -2;
						if (next === -2) return;
						tab = TABS[(next + TABS.length) % TABS.length].id;
						document.getElementById(`tab-${tab}`)?.focus();
					}}
				>
					{t.label}
					{#if t.id === 'fitur' && ed.features.length > 0}<span class="jumlah">{ed.features.length}</span>{/if}
					{#if t.id === 'fitur' && ed.invalidCount > 0}<span class="titik" aria-label="{ed.invalidCount} fitur tidak valid"></span>{/if}
					{#if t.id === 'tim' && r.likely.sprint.unstaffedRoleIds.length > 0}<span class="titik" aria-label="Ada peran tanpa orang"></span>{/if}
				</button>
			{/each}
		</div>

		<div class="tab-isi" role="tabpanel" id="panel-{tab}" aria-labelledby="tab-{tab}">
			{#if tab === 'fitur'}
				<FeaturesTab {ed} ai={data.ai} needs={p.needs} prospectId={p.id} library={data.library} />
			{:else if tab === 'tim'}
				<TeamTab {ed} deadline={p.deadline} />
			{:else if tab === 'biaya'}
				<CostTab {ed} onRefreshRates={() => runAction('refreshRates')} />
			{:else if tab === 'skenario'}
				<ScenariosTab {ed} />
			{:else}
				<ParamsTab {ed} />
			{/if}
		</div>
	</div>

	<aside class="panel" id="ringkasan" aria-label="Ringkasan estimasi">
		<div class="panel-kepala"><h2>Ringkasan</h2></div>
		<div class="panel-isi">
			<Summary {ed} budget={p.budget} {finalizing} onFinalize={finalize} />
		</div>
	</aside>
</div>

{#if r.totalEffort.e > 0}
	<a class="bar-bawah" href="#ringkasan">
		<span><strong>{r.likely.sprint.totalSprints}</strong> sprint · ± {decimal(r.likely.sprint.months, 1)} bln</span>
		<span><strong>{rupiahShort(r.likely.cost.price)}</strong></span>
		<span class="lihat">Ringkasan</span>
	</a>
{/if}

<style>
	.kepala {
		margin-bottom: var(--jarak-6);
	}
	.judul-baris {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--jarak-4);
		flex-wrap: wrap;
	}
	.judul {
		display: flex;
		align-items: center;
		gap: var(--jarak-3);
	}
	.meta {
		margin: var(--jarak-1) 0 0;
		color: var(--tinta-2);
	}
	.kanan {
		display: flex;
		align-items: center;
		gap: var(--jarak-4);
	}
	.simpan {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.simpan.waspada {
		color: var(--waspada);
	}
	.simpan.kritis {
		color: var(--kritis);
	}
	.simpan :global(.putar) {
		animation: putar 1s linear infinite;
	}
	@keyframes putar {
		to {
			transform: rotate(360deg);
		}
	}
	.tata {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 320px;
		gap: var(--jarak-6);
		align-items: start;
	}
	.tab {
		display: flex;
		gap: var(--jarak-1);
		margin-bottom: var(--jarak-4);
		border-bottom: 1px solid var(--garis);
	}
	.tab button {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 40px;
		padding: 0 var(--jarak-4);
		border: 0;
		background: none;
		font: inherit;
		font-weight: 500;
		color: var(--tinta-2);
		cursor: pointer;
	}
	.tab button:hover {
		color: var(--tinta);
	}
	.tab button[aria-selected='true'] {
		color: var(--nila);
	}
	.tab button[aria-selected='true']::after {
		content: '';
		position: absolute;
		left: var(--jarak-2);
		right: var(--jarak-2);
		bottom: -1px;
		height: 2px;
		border-radius: 2px 2px 0 0;
		background: var(--nila);
	}
	.jumlah {
		min-width: 20px;
		padding: 0 6px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--kertas), var(--garis) 60%);
		font-size: var(--teks-mini);
		color: var(--tinta-2);
		text-align: center;
	}
	.titik {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--kritis);
	}
	aside {
		position: sticky;
		top: var(--jarak-6);
	}
	aside h2 {
		font-size: var(--teks-isi);
	}
	.bar-bawah {
		display: none;
	}
	@media (max-width: 1023px) {
		.tata {
			grid-template-columns: minmax(0, 1fr);
		}
		aside {
			position: static;
			scroll-margin-top: var(--jarak-6);
		}
		.bar-bawah {
			position: sticky;
			bottom: 0;
			display: flex;
			align-items: center;
			gap: var(--jarak-4);
			margin-top: var(--jarak-6);
			padding: var(--jarak-3) var(--jarak-4);
			background: var(--permukaan);
			border: 1px solid var(--garis);
			border-radius: var(--radius-panel);
			color: var(--tinta);
			text-decoration: none;
			font-variant-numeric: tabular-nums;
			box-shadow: var(--bayangan-melayang);
		}
		.lihat {
			margin-left: auto;
			color: var(--nila);
			font-weight: 500;
		}
	}
</style>
