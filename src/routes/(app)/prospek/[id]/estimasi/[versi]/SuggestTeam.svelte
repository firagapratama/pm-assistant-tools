<script lang="ts">
	// Saran jumlah orang per peran agar selesai dalam target (sprint atau tenggat klien). Matematika murni, tanpa AI.
	import { Sparkles, X } from '@lucide/svelte';
	import { suggestTeam } from '#lib/calc/capacity.ts';
	import NumInput from '#lib/components/NumInput.svelte';
	import { toast } from '#lib/components/toast.svelte.ts';
	import { computeDraft } from '#lib/estimate.ts';
	import { date, decimal, rupiahShort } from '#lib/format/index.ts';
	import type { EstimateEditor } from './editor.svelte.ts';

	let { ed, deadline }: { ed: EstimateEditor; deadline: string | null } = $props();

	let open = $state(false);
	let basis: 'likely' | 'safe' = $state('likely');
	let stab = $derived(ed.settings.stabilizationSprints);
	let deadlineSprints = $derived(ed.calendar && deadline ? ed.calendar.sprintsUntil(deadline) : null);
	// svelte-ignore state_referenced_locally — nilai awal: tenggat klien bila bisa dihitung, kalau tidak durasi sekarang.
	let target: number | null = $state(null);

	function start() {
		target = deadlineSprints && deadlineSprints > stab ? deadlineSprints : Math.max(stab + 1, ed.result.likely.sprint.totalSprints);
		open = true;
	}

	let devTarget = $derived(target === null ? 0 : Math.floor(target) - stab);
	let effort = $derived(
		new Map(
			[...ed.result.effort].map(([id, r]) => [id, basis === 'safe' ? r.e + ed.settings.rangeSigma * r.sigma : r.e])
		)
	);
	let suggestion = $derived(devTarget > 0 ? suggestTeam(effort, ed.settings, devTarget, ed.calendar?.factor) : new Map<number, number>());
	let rows = $derived([...suggestion].map(([roleId, mp]) => ({ roleId, now: ed.member(roleId)?.mp ?? 0, mp })));
	let impossible = $derived(rows.some((r) => !Number.isFinite(r.mp)));

	/** Hasil bila saran diterapkan: tim sekarang dengan MP peran yang disarankan diganti. */
	let preview = $derived.by(() => {
		if (devTarget <= 0 || impossible || rows.length === 0) return null;
		const team = ed.rates.map((r) => {
			const current = ed.member(r.roleId);
			return { roleId: r.roleId, mp: suggestion.get(r.roleId) ?? current?.mp ?? 0, months: current?.months ?? null };
		});
		return computeDraft({ ...ed.draft, team }, ed.rates, ed.holidays).likely;
	});

	function apply() {
		for (const r of rows) ed.setMember(r.roleId, { mp: r.mp });
		open = false;
		toast(`Tim disesuaikan untuk target ${target} sprint`);
	}
</script>

{#if !open}
	<button class="btn" onclick={start} disabled={ed.locked || ed.result.totalEffort.e === 0}>
		<Sparkles size={16} strokeWidth={1.75} aria-hidden="true" /> Sarankan tim
	</button>
{:else}
	<section class="panel saran" aria-labelledby="saran-judul">
		<div class="panel-kepala">
			<h3 id="saran-judul">Sarankan tim</h3>
			<button class="btn teks kecil" aria-label="Tutup" onclick={() => (open = false)}><X size={16} strokeWidth={1.75} /></button>
		</div>
		<div class="panel-isi isi">
			<div class="kontrol">
				<label class="field target">
					<span class="field-label">Target selesai (termasuk {stab} sprint stabilisasi)</span>
					<NumInput value={target} onchange={(v) => (target = v)} emptyValue={null} digits={0} suffix="sprint" label="Target jumlah sprint" />
				</label>
				<div class="field">
					<span class="field-label" id="basis-label">Dasar effort</span>
					<div class="segmen" role="radiogroup" aria-labelledby="basis-label">
						<button role="radio" aria-checked={basis === 'likely'} onclick={() => (basis = 'likely')}>Paling mungkin</button>
						<button role="radio" aria-checked={basis === 'safe'} onclick={() => (basis = 'safe')}>Aman (+{decimal(ed.settings.rangeSigma, 1)}σ)</button>
					</div>
				</div>
			</div>

			{#if deadline}
				{#if deadlineSprints !== null}
					<p class="field-hint">
						Tenggat klien {date(deadline)}: muat {deadlineSprints} sprint dari rencana mulai.
						{#if deadlineSprints !== target && deadlineSprints > stab}
							<button class="btn teks kecil" onclick={() => (target = deadlineSprints)}>Pakai tenggat</button>
						{/if}
					</p>
				{:else}
					<p class="field-hint">Isi rencana mulai di atas agar target bisa dihitung dari tenggat klien ({date(deadline)}).</p>
				{/if}
			{/if}

			{#if target !== null && devTarget <= 0}
				<p class="pesan-error">Target terlalu pendek: minimal {stab + 1} sprint karena ada {stab} sprint stabilisasi.</p>
			{:else if impossible}
				<p class="pesan-error">Tidak ada hari kerja dalam target ini. Periksa kalender libur atau tanggal mulai.</p>
			{:else if rows.length > 0}
				<table>
					<thead>
						<tr>
							<th>Peran</th>
							<th class="angka">Sekarang</th>
							<th class="angka">Saran</th>
						</tr>
					</thead>
					<tbody>
						{#each rows as r (r.roleId)}
							<tr>
								<td>{ed.roleName(r.roleId)}</td>
								<td class="angka redup">{decimal(r.now, 1)}</td>
								<td class="angka">
									<strong class:naik={r.mp > r.now} class:turun={r.mp < r.now}>{decimal(r.mp, 1)}</strong>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
				{#if preview}
					<p class="info">
						Hasil: <strong>{preview.sprint.totalSprints} sprint</strong>
						{#if ed.calendar}· selesai {date(ed.calendar.endDate(preview.sprint.totalSprints))}{/if}
						· harga <strong>{rupiahShort(preview.cost.price)}</strong>
						<span class="redup">(sekarang {ed.result.likely.sprint.totalSprints} sprint, {rupiahShort(ed.result.likely.cost.price)})</span>
					</p>
				{/if}
				<p class="field-hint">
					Peran tanpa effort (misalnya PM) dan bulan keterlibatan tidak diubah. Menambah orang tidak selalu mempercepat
					secara linear; pertimbangkan waktu onboarding.
				</p>
				<div class="aksi">
					<button class="btn teks" onclick={() => (open = false)}>Batal</button>
					<button class="btn" onclick={apply}>Terapkan saran</button>
				</div>
			{/if}
		</div>
	</section>
{/if}

<style>
	.saran {
		margin-bottom: var(--jarak-6);
	}
	.saran h3 {
		font-size: var(--teks-isi);
	}
	.isi {
		display: grid;
		gap: var(--jarak-4);
	}
	.kontrol {
		display: flex;
		gap: var(--jarak-6);
		flex-wrap: wrap;
		align-items: flex-end;
	}
	.target {
		width: 280px;
	}
	.segmen {
		display: inline-flex;
		height: 36px;
		padding: 3px;
		gap: 2px;
		border-radius: var(--radius-kecil);
		background: color-mix(in srgb, var(--kertas), var(--garis) 55%);
	}
	.segmen button {
		padding: 0 var(--jarak-3);
		border: 0;
		border-radius: 4px;
		background: none;
		font: inherit;
		font-size: var(--teks-kecil);
		font-weight: 500;
		color: var(--tinta-2);
		cursor: pointer;
	}
	.segmen button[aria-checked='true'] {
		background: var(--permukaan);
		color: var(--nila);
		box-shadow: 0 1px 2px rgba(28, 34, 48, 0.08);
	}
	table {
		max-width: 480px;
	}
	td,
	th {
		padding: var(--jarak-2) var(--jarak-3);
	}
	.naik {
		color: var(--nila);
	}
	.turun {
		color: var(--tinta-2);
	}
	.redup {
		color: var(--tinta-2);
	}
	.aksi {
		display: flex;
		justify-content: flex-end;
		gap: var(--jarak-2);
	}
	.field-hint .btn {
		height: 24px;
		margin-left: var(--jarak-1);
	}
</style>
