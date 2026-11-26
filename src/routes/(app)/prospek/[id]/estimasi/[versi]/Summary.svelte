<script lang="ts">
	import { Check, Lock } from '@lucide/svelte';
	import RangeBand from '#lib/components/RangeBand.svelte';
	import { sorot } from '#lib/components/sorot.ts';
	import { date, decimal, range, rupiahShort } from '#lib/format/index.ts';
	import type { EstimateEditor } from './editor.svelte.ts';

	let {
		ed,
		budget,
		finalizing,
		onFinalize
	}: { ed: EstimateEditor; budget: number | null; finalizing: boolean; onFinalize: () => void } = $props();

	let r = $derived(ed.result);
	let stab = $derived(ed.settings.stabilizationSprints);
	// Sprint pita rentang: sprint pengembangan (belum dibulatkan) + stabilisasi.
	const sprints = (x: { sprint: { devSprintsRaw: number } }) => x.sprint.devSprintsRaw + stab;
	let hasEffort = $derived(r.totalEffort.e > 0);
	let price = $derived(r.likely.cost.price);
	let overBudget = $derived(budget !== null && price > budget);
	let bottleneck = $derived(r.likely.sprint.bottleneckRoleId);
</script>

<div class="ringkasan">
	<section class="blok" aria-labelledby="durasi-label">
		<span class="label" id="durasi-label">Durasi</span>
		{#if hasEffort}
			<p class="angka-besar">
				<span use:sorot={r.likely.sprint.totalSprints}>{r.likely.sprint.totalSprints}</span><span class="satuan">sprint</span>
				<span class="setara">± {decimal(r.likely.sprint.months, 1)} bulan</span>
			</p>
			<p class="rentang">
				rentang {range(String(r.low.sprint.totalSprints), String(r.high.sprint.totalSprints))} sprint
			</p>
			{#if ed.calendar}
				<p class="tanggal">
					{date(ed.calendar.start)} – <strong use:sorot={ed.calendar.endDate(r.likely.sprint.totalSprints)}>{date(ed.calendar.endDate(r.likely.sprint.totalSprints))}</strong>
				</p>
			{/if}
			<RangeBand
				size="besar"
				o={sprints(r.optimistic)}
				lo={sprints(r.low)}
				e={sprints(r.likely)}
				hi={sprints(r.high)}
				p={sprints(r.pessimistic)}
				format={(n) => decimal(n, 1)}
				label="Durasi {r.low.sprint.totalSprints} sampai {r.high.sprint.totalSprints} sprint, paling mungkin {r.likely.sprint.totalSprints}"
			/>
		{:else}
			<p class="kosong-kecil">Isi effort fitur dan jumlah orang untuk melihat durasi.</p>
		{/if}
	</section>

	<section class="blok" aria-labelledby="harga-label">
		<span class="label" id="harga-label">Harga jual</span>
		{#if hasEffort && price > 0}
			<p class="angka-besar"><span use:sorot={price}>{rupiahShort(price)}</span></p>
			<p class="rentang">rentang {range(rupiahShort(r.low.cost.price), rupiahShort(r.high.cost.price))}</p>
			<RangeBand
				size="besar"
				o={r.optimistic.cost.price}
				lo={r.low.cost.price}
				e={price}
				hi={r.high.cost.price}
				p={r.pessimistic.cost.price}
				label="Harga {rupiahShort(r.low.cost.price)} sampai {rupiahShort(r.high.cost.price)}, paling mungkin {rupiahShort(price)}"
			/>
			{#if budget !== null}
				<p class="anggaran">
					{#if overBudget}
						<span class="badge waspada">Di atas anggaran</span>
					{:else}
						<span class="badge aman">Dalam anggaran</span>
					{/if}
					klien {rupiahShort(budget)}
				</p>
			{/if}
		{:else}
			<p class="kosong-kecil">Muncul setelah tim dan rate terisi.</p>
		{/if}
	</section>

	{#if hasEffort}
		<dl class="rincian">
			<dt>Total effort</dt>
			<dd>{ed.effortText(r.totalEffort.e, 0)}</dd>
			<dt>Total biaya</dt>
			<dd use:sorot={r.likely.cost.total}>{rupiahShort(r.likely.cost.total)}</dd>
			<dt>Margin</dt>
			<dd>{decimal(r.likely.cost.margin * 100, 1)}%</dd>
			<dt>Time &amp; material</dt>
			<dd>{rupiahShort(r.likely.cost.tmTotal)}</dd>
			{#if bottleneck !== null}
				<dt>Bottleneck</dt>
				<dd class="bottleneck">{ed.roleName(bottleneck)}</dd>
			{/if}
		</dl>
	{/if}

	<div class="final">
		{#if ed.locked}
			<p class="terkunci"><Lock size={14} strokeWidth={1.75} aria-hidden="true" /> Versi final terkunci. Buat versi baru dari halaman prospek untuk merevisi.</p>
		{:else}
			{#if ed.problems.length > 0}
				<div class="cek">
					<span class="label">Sebelum ditandai final</span>
					<ul>
						{#each ed.problems as p (p)}<li>{p}</li>{/each}
					</ul>
				</div>
			{:else}
				<p class="siap"><Check size={14} strokeWidth={2} aria-hidden="true" /> Siap ditandai final</p>
			{/if}
			<button class="btn primer" disabled={ed.problems.length > 0 || ed.invalidCount > 0 || finalizing} onclick={onFinalize}>
				{finalizing ? 'Menandai…' : 'Tandai final'}
			</button>
		{/if}
	</div>
</div>

<style>
	.ringkasan {
		display: grid;
		gap: var(--jarak-6);
	}
	.blok {
		display: grid;
		gap: var(--jarak-1);
	}
	.label {
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.angka-besar {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0 var(--jarak-2);
		margin: 0;
		font-size: var(--teks-angka-besar);
		line-height: 1.1;
		font-weight: 600;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}
	.angka-besar > span:first-child {
		padding: 0 2px;
		margin: 0 -2px;
	}
	.satuan {
		font-size: var(--teks-isi);
		font-weight: 500;
		color: var(--tinta-2);
		letter-spacing: 0;
	}
	.setara {
		flex-basis: 100%;
		font-size: var(--teks-isi);
		font-weight: 500;
		letter-spacing: 0;
	}
	.rentang {
		margin: 0 0 var(--jarak-2);
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
		font-variant-numeric: tabular-nums;
	}
	.tanggal {
		margin: calc(-1 * var(--jarak-2)) 0 var(--jarak-2);
		font-size: var(--teks-kecil);
		font-variant-numeric: tabular-nums;
	}
	.anggaran {
		display: flex;
		align-items: center;
		gap: var(--jarak-2);
		margin: var(--jarak-2) 0 0;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.kosong-kecil {
		margin: 0;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.rincian {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--jarak-2) var(--jarak-4);
		margin: 0;
		padding-top: var(--jarak-4);
		border-top: 1px solid var(--garis);
		font-size: var(--teks-kecil);
	}
	dt {
		color: var(--tinta-2);
	}
	dd {
		margin: 0;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.bottleneck {
		color: var(--nila);
		font-weight: 500;
	}
	.final {
		display: grid;
		gap: var(--jarak-3);
		padding-top: var(--jarak-4);
		border-top: 1px solid var(--garis);
	}
	.final .btn {
		width: 100%;
	}
	.cek ul {
		margin: var(--jarak-1) 0 0;
		padding-left: 1.1em;
		font-size: var(--teks-kecil);
		color: var(--tinta);
	}
	.cek li + li {
		margin-top: 2px;
	}
	.siap,
	.terkunci {
		display: flex;
		align-items: flex-start;
		gap: var(--jarak-2);
		margin: 0;
		font-size: var(--teks-kecil);
	}
	.siap {
		color: var(--aman);
	}
	.terkunci {
		color: var(--tinta-2);
	}
</style>
