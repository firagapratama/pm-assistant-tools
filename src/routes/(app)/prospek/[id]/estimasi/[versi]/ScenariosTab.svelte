<script lang="ts">
	// Skenario (PRD F7): bandingkan tim/prioritas lain berdampingan dengan skenario utama (tab Tim).
	import { Plus, Trash2, UsersRound } from '@lucide/svelte';
	import NumInput from '#lib/components/NumInput.svelte';
	import { toast } from '#lib/components/toast.svelte.ts';
	import type { ScenarioResult } from '#lib/calc/index.ts';
	import { date, decimal, rupiahShort } from '#lib/format/index.ts';
	import type { DraftScenario } from '#lib/validation/estimate.ts';
	import type { EstimateEditor } from './editor.svelte.ts';

	let { ed }: { ed: EstimateEditor } = $props();

	const FILTERS = [
		{ value: 'semua', label: 'Semua fitur', priorities: null },
		{ value: 'must-should', label: 'Must + Should', priorities: ['must', 'should'] },
		{ value: 'must', label: 'Hanya Must', priorities: ['must'] }
	] as const;
	const filterOf = (s: DraftScenario) => (s.priorities === null ? 'semua' : s.priorities.includes('should') ? 'must-should' : 'must');
	const filterLabel = (s: DraftScenario | null) => (s ? FILTERS.find((f) => f.value === filterOf(s))!.label : 'Semua fitur');

	interface Column {
		key: string;
		title: string;
		scenario: DraftScenario | null;
		r: ScenarioResult;
		people: number;
	}
	let columns: Column[] = $derived([
		{ key: 'utama', title: 'A · Utama', scenario: null, r: ed.result, people: ed.team.reduce((a, t) => a + t.mp, 0) },
		...ed.scenarios.map((s, i) => ({ key: `s${i}`, title: s.name, scenario: s, r: ed.alternative(s), people: s.team.reduce((a, t) => a + t.mp, 0) }))
	]);
	let base = $derived(columns[0].r.likely);
	let minPrice = $derived(Math.min(...columns.map((c) => c.r.likely.cost.price).filter((n) => n > 0)));
	let minSprints = $derived(Math.min(...columns.map((c) => c.r.likely.sprint.totalSprints).filter((n) => n > 0)));

	/** Peran yang relevan: punya effort, ada di tim utama, atau ada di salah satu skenario. */
	let roleIds = $derived(
		ed.rates
			.map((r) => r.roleId)
			.filter((id) => (ed.result.effort.get(id)?.e ?? 0) > 0 || (ed.member(id)?.mp ?? 0) > 0 || ed.scenarios.some((s) => s.team.some((t) => t.roleId === id && t.mp > 0)))
	);

	const signed = (n: number, digits = 0) => (Math.abs(n) < 10 ** -digits / 2 ? '' : `${n > 0 ? '+' : '−'}${decimal(Math.abs(n), digits)}`);
	const signedRp = (n: number) => (n === 0 ? '' : `${n > 0 ? '+' : '−'}${rupiahShort(Math.abs(n))}`);

	function remove(i: number) {
		const name = ed.scenarios[i].name;
		const undo = ed.removeScenario(i);
		toast(`${name} dihapus`, 'info', { label: 'Urungkan', run: undo });
	}
	function useTeam(s: DraftScenario) {
		const undo = ed.useScenarioTeam(s);
		toast(`Tim ${s.name} dipakai sebagai tim utama`, 'info', { label: 'Urungkan', run: undo });
	}
</script>

<p class="keterangan">
	Bandingkan opsi seperti "tim kecil, lebih lama" dengan "tim besar, lebih cepat", atau hanya fitur Must-have. Skenario utama adalah tim di
	tab Tim; itulah yang dipakai ringkasan direksi dan baseline proyek. Menambah orang tidak mempercepat secara linear karena ada onboarding
	dan koordinasi.
</p>

<div class="tabel-wadah">
	<table class="banding">
		<thead>
			<tr>
				<th></th>
				{#each columns as c (c.key)}<th class="angka">{c.title}</th>{/each}
			</tr>
		</thead>
		<tbody>
			<tr>
				<th scope="row">Fitur dihitung</th>
				{#each columns as c (c.key)}
					<td class="angka">{c.scenario?.priorities ? ed.features.filter((f) => c.scenario!.priorities!.includes(f.priority)).length : ed.features.length}<span class="sub">{filterLabel(c.scenario)}</span></td>
				{/each}
			</tr>
			<tr>
				<th scope="row">Orang</th>
				{#each columns as c (c.key)}<td class="angka">{decimal(c.people, 1)}</td>{/each}
			</tr>
			<tr>
				<th scope="row">Effort</th>
				{#each columns as c (c.key)}<td class="angka">{ed.effortText(c.r.totalEffort.e, 0)}</td>{/each}
			</tr>
			<tr>
				<th scope="row">Sprint</th>
				{#each columns as c (c.key)}
					{@const n = c.r.likely.sprint.totalSprints}
					<td class="angka" class:terbaik={columns.length > 1 && n === minSprints}>
						{n || '–'}
						{#if c.scenario}<span class="sub">{signed(n - base.sprint.totalSprints)}</span>{/if}
					</td>
				{/each}
			</tr>
			<tr>
				<th scope="row">Durasi</th>
				{#each columns as c (c.key)}
					<td class="angka">
						{decimal(c.r.likely.sprint.weeks, 0)} minggu
						<span class="sub">± {decimal(c.r.likely.sprint.months, 1)} bulan{ed.calendar && c.r.likely.sprint.totalSprints ? ` · selesai ${date(ed.calendar.endDate(c.r.likely.sprint.totalSprints))}` : ''}</span>
					</td>
				{/each}
			</tr>
			<tr>
				<th scope="row">Total biaya</th>
				{#each columns as c (c.key)}
					<td class="angka">{rupiahShort(c.r.likely.cost.total)}{#if c.scenario}<span class="sub">{signedRp(c.r.likely.cost.total - base.cost.total)}</span>{/if}</td>
				{/each}
			</tr>
			<tr>
				<th scope="row">Harga jual</th>
				{#each columns as c (c.key)}
					{@const price = c.r.likely.cost.price}
					<td class="angka harga" class:terbaik={columns.length > 1 && price === minPrice}>
						{rupiahShort(price)}{#if c.scenario}<span class="sub">{signedRp(price - base.cost.price)}</span>{/if}
					</td>
				{/each}
			</tr>
		</tbody>
	</table>
</div>
{#if columns.length > 1}<p class="catatan">Tebal = paling cepat (sprint) dan paling murah (harga jual). Selisih dihitung terhadap skenario utama.</p>{/if}

<div class="daftar">
	{#each ed.scenarios as s, i (i)}
		<section class="panel skenario" aria-label={s.name}>
			<div class="kepala">
				<label class="field nama">
					<span class="field-label">Nama skenario</span>
					<input bind:value={s.name} maxlength="80" disabled={ed.locked} />
				</label>
				<label class="field">
					<span class="field-label">Fitur yang dihitung</span>
					<select
						value={filterOf(s)}
						disabled={ed.locked}
						onchange={(e) => (s.priorities = FILTERS.find((f) => f.value === e.currentTarget.value)!.priorities?.slice() ?? null)}
					>
						{#each FILTERS as f (f.value)}<option value={f.value}>{f.label}</option>{/each}
					</select>
				</label>
			</div>
			<div class="tim">
				{#each roleIds as id (id)}
					<span class="peran">{ed.roleName(id)}</span>
					<NumInput
						value={s.team.find((t) => t.roleId === id)?.mp ?? 0}
						onchange={(v) => ed.setScenarioMp(s, id, v ?? 0)}
						digits={1}
						suffix="org"
						disabled={ed.locked}
						label="{s.name}: jumlah {ed.roleName(id)}"
					/>
					<span class="utama">utama {decimal(ed.member(id)?.mp ?? 0, 1)}</span>
				{/each}
			</div>
			{#if !ed.locked}
				<div class="aksi">
					<button class="btn kecil bahaya" onclick={() => remove(i)}><Trash2 size={14} strokeWidth={1.75} aria-hidden="true" /> Hapus</button>
					<span class="ruang"></span>
					<button class="btn kecil" onclick={() => useTeam(s)} title="Salin jumlah orang skenario ini ke tab Tim">
						<UsersRound size={14} strokeWidth={1.75} aria-hidden="true" /> Pakai tim ini sebagai utama
					</button>
				</div>
			{/if}
		</section>
	{/each}
</div>

{#if !ed.locked}
	<button class="btn" onclick={() => ed.addScenario()} disabled={!ed.canAddScenario}>
		<Plus size={16} strokeWidth={2} aria-hidden="true" /> Tambah skenario
	</button>
	{#if !ed.canAddScenario}<span class="field-hint">Maksimal 5 skenario alternatif.</span>{/if}
{/if}

<style>
	.keterangan,
	.catatan {
		margin: 0 0 var(--jarak-4);
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.catatan {
		margin-top: var(--jarak-2);
	}
	.banding th[scope='row'] {
		font-weight: 500;
		text-align: left;
		white-space: nowrap;
	}
	.banding td {
		vertical-align: top;
		white-space: nowrap;
	}
	.sub {
		display: block;
		font-size: var(--teks-mini);
		color: var(--tinta-2);
	}
	.terbaik {
		font-weight: 600;
	}
	.harga {
		font-size: var(--teks-isi);
	}
	.daftar {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: var(--jarak-4);
		margin: var(--jarak-6) 0 var(--jarak-4);
	}
	.skenario {
		display: grid;
		gap: var(--jarak-4);
		align-content: start;
		padding: var(--jarak-6);
	}
	.kepala {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 150px;
		gap: var(--jarak-3);
	}
	.tim {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 110px auto;
		gap: var(--jarak-2) var(--jarak-3);
		align-items: center;
		font-size: var(--teks-kecil);
	}
	.peran {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.utama {
		color: var(--tinta-2);
		font-size: var(--teks-mini);
		white-space: nowrap;
	}
	.aksi {
		display: flex;
		align-items: center;
		gap: var(--jarak-2);
	}
	.ruang {
		flex: 1;
	}
</style>
