<script lang="ts">
	import { Plus, RefreshCw, Trash2 } from '@lucide/svelte';
	import NumInput from '#lib/components/NumInput.svelte';
	import { decimal, percentBp, range, rupiah, rupiahShort } from '#lib/format/index.ts';
	import type { EstimateEditor } from './editor.svelte.ts';

	let { ed, onRefreshRates }: { ed: EstimateEditor; onRefreshRates: () => void } = $props();

	let cost = $derived(ed.result.likely.cost);
	let low = $derived(ed.result.low.cost);
	let high = $derived(ed.result.high.cost);
	let lines = $derived(cost.roles.filter((r) => r.mp > 0));
	let missing = $derived(cost.missingRateRoleIds);
</script>

<div class="rate-info" class:waspada={missing.length > 0}>
	<p>
		{#if missing.length > 0}
			Rate {missing.map(ed.roleName).join(', ')} belum diisi. Isi di Pengaturan, lalu ambil rate &amp; kalender terbaru.
		{:else}
			Rate dan kalender libur disalin dari Pengaturan saat estimasi dibuat, sehingga perubahannya tidak mengubah estimasi ini.
		{/if}
	</p>
	{#if !ed.locked}
		<button class="btn kecil" onclick={onRefreshRates}><RefreshCw size={14} strokeWidth={1.75} aria-hidden="true" /> Ambil rate &amp; kalender terbaru</button>
	{/if}
</div>

<div class="tabel-wadah">
	<table>
		<thead>
			<tr>
				<th>Komponen</th>
				<th class="angka">Orang</th>
				<th class="angka">Rate / bulan</th>
				<th class="angka">Bulan</th>
				<th class="angka">Jumlah</th>
			</tr>
		</thead>
		<tbody>
			{#each lines as r (r.roleId)}
				<tr>
					<td>{ed.roleName(r.roleId)}</td>
					<td class="angka">{decimal(r.mp, 2)}</td>
					<td class="angka">
						{#if missing.includes(r.roleId)}<span class="badge waspada">Belum diisi</span>{:else}{rupiah(r.rate)}{/if}
					</td>
					<td class="angka">{decimal(r.months, 2)}</td>
					<td class="angka">{rupiah(r.amount)}</td>
				</tr>
			{:else}
				<tr><td colspan="5" class="redup">Belum ada orang di Tim.</td></tr>
			{/each}

			<tr class="sub-judul"><td colspan="5">Overhead</td></tr>
			{#each ed.overhead as item, i (i)}
				<tr class="overhead">
					<td colspan="4">
						<input
							bind:value={item.label}
							placeholder="Server, lisensi, perjalanan…"
							disabled={ed.locked}
							aria-label="Nama overhead {i + 1}"
						/>
					</td>
					<td class="angka">
						<div class="overhead-jumlah">
							<NumInput
								value={item.amount}
								onchange={(v) => (item.amount = Math.round(v ?? 0))}
								prefix="Rp"
								digits={0}
								placeholder="0"
								disabled={ed.locked}
								label="Jumlah overhead {item.label || i + 1}"
							/>
							{#if !ed.locked}
								<button class="btn teks kecil" aria-label="Hapus overhead {item.label || i + 1}" onclick={() => ed.overhead.splice(i, 1)}>
									<Trash2 size={14} strokeWidth={1.75} />
								</button>
							{/if}
						</div>
					</td>
				</tr>
			{/each}
			{#if !ed.locked}
				<tr class="tanpa-hover">
					<td colspan="5">
						<button class="btn teks kecil" onclick={() => ed.overhead.push({ label: '', amount: 0 })}>
							<Plus size={14} strokeWidth={2} aria-hidden="true" /> Tambah overhead
						</button>
					</td>
				</tr>
			{/if}
		</tbody>
		<tbody class="hitung">
			<tr class="total"><td colspan="4">Subtotal</td><td class="angka">{rupiah(cost.subtotal)}</td></tr>
			<tr><td colspan="4">Contingency {percentBp(ed.settings.contingencyBp)}</td><td class="angka">{rupiah(cost.contingency)}</td></tr>
			<tr class="total"><td colspan="4">Total biaya</td><td class="angka">{rupiah(cost.total)}</td></tr>
			<tr><td colspan="4">Markup {percentBp(ed.settings.markupBp)}</td><td class="angka">{rupiah(cost.price - cost.total)}</td></tr>
			<tr class="total harga"><td colspan="4">Harga jual (fixed price)</td><td class="angka">{rupiah(cost.price)}</td></tr>
			<tr class="info-baris">
				<td colspan="4">Margin dari harga jual</td>
				<td class="angka">{decimal(cost.margin * 100, 1)}%</td>
			</tr>
		</tbody>
	</table>
</div>

<p class="ringkas">
	Rentang harga jual {range(rupiahShort(low.price), rupiahShort(high.price))} (±{decimal(ed.settings.rangeSigma, 1)}σ). Markup
	{percentBp(ed.settings.markupBp)} di atas biaya setara margin {decimal(cost.margin * 100, 1)}% dari harga jual.
</p>

<section class="panel tm" aria-labelledby="tm-judul">
	<div class="panel-kepala">
		<h3 id="tm-judul">Sudut pandang time &amp; material</h3>
	</div>
	<div class="panel-isi tm-isi">
		<div>
			<span class="label">Tarif tim per bulan</span>
			<strong class="angka">{rupiah(cost.tmMonthlyRate)}</strong>
		</div>
		<div>
			<span class="label">Perkiraan total</span>
			<strong class="angka">{rupiah(cost.tmTotal)}</strong>
			<span class="sub">rentang {range(rupiahShort(low.tmTotal), rupiahShort(high.tmTotal))}</span>
		</div>
		<p class="field-hint penuh">
			Klien dibayar per bulan sesuai pemakaian tim: biaya × (1 + markup), tanpa contingency karena risiko durasi
			ditanggung klien. Selisih dengan fixed price: {rupiah(cost.price - cost.tmTotal)}.
		</p>
	</div>
</section>

<style>
	.rate-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--jarak-4);
		margin-bottom: var(--jarak-3);
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.rate-info p {
		margin: 0;
	}
	.rate-info.waspada p {
		color: var(--waspada);
	}
	.sub-judul td {
		padding-top: var(--jarak-4);
		font-size: var(--teks-kecil);
		font-weight: 600;
		color: var(--tinta-2);
		background: none !important;
	}
	tr.overhead td {
		padding-top: var(--jarak-2);
		padding-bottom: var(--jarak-2);
	}
	.overhead input {
		height: 36px;
	}
	.overhead-jumlah {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: var(--jarak-1);
	}
	.overhead-jumlah :global(.input-grup) {
		width: 180px;
	}
	tr.tanpa-hover:hover,
	tbody.hitung tr:hover {
		background: none;
	}
	tbody.hitung tr:first-child td {
		border-top: 1.5px solid var(--tinta);
	}
	tbody.hitung tr.total:not(:first-child) td {
		border-top: 1px solid var(--garis);
	}
	tr.harga td {
		font-size: var(--teks-h3);
	}
	.info-baris td {
		color: var(--tinta-2);
		font-size: var(--teks-kecil);
	}
	.redup {
		color: var(--tinta-2);
	}
	.ringkas {
		margin: var(--jarak-3) 0 var(--jarak-8);
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.tm-isi {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--jarak-4) var(--jarak-6);
	}
	.tm-isi > div {
		display: grid;
		gap: 2px;
	}
	.label {
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.tm-isi strong {
		font-size: var(--teks-h3);
		font-weight: 600;
	}
	.sub {
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.penuh {
		grid-column: 1 / -1;
		margin: 0;
	}
</style>
