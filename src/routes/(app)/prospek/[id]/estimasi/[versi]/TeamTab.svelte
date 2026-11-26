<script lang="ts">
	import { hoursPerPersonPerSprint } from '#lib/calc/capacity.ts';
	import NumInput from '#lib/components/NumInput.svelte';
	import { CalendarDays } from '@lucide/svelte';
	import { date, decimal } from '#lib/format/index.ts';
	import SuggestTeam from './SuggestTeam.svelte';
	import type { EstimateEditor } from './editor.svelte.ts';

	let { ed, deadline }: { ed: EstimateEditor; deadline: string | null } = $props();

	let plan = $derived(ed.result.likely.sprint);
	let perPerson = $derived(hoursPerPersonPerSprint(ed.settings));
	/** Peran dengan effort atau orang lebih dulu, lalu sisanya. */
	let rows = $derived(
		[...ed.rates].sort((a, b) => {
			const w = (id: number) => ((ed.result.effort.get(id)?.e ?? 0) > 0 ? 2 : 0) + ((ed.member(id)?.mp ?? 0) > 0 ? 1 : 0);
			return w(b.roleId) - w(a.roleId);
		})
	);
	const sprintOf = (id: number) => plan.roles.find((r) => r.roleId === id)?.sprints ?? 0;

	let schedule = $derived(ed.calendar?.schedule(plan.totalSprints) ?? []);
	let lostDays = $derived(schedule.reduce((a, w) => a + w.holidays.length, 0));
	const isMonday = (iso: string) => new Date(iso + 'T00:00:00Z').getUTCDay() === 1;
	const holidayNames = (hs: { name: string }[]) => [...new Set(hs.map((h) => h.name))].join(', ');
</script>

<section class="panel jadwal" aria-labelledby="jadwal-judul">
	<div class="jadwal-isi">
		<div class="jadwal-teks">
			<h3 id="jadwal-judul"><CalendarDays size={16} strokeWidth={1.75} aria-hidden="true" /> Jadwal</h3>
			<p>
				Isi rencana mulai agar libur nasional dan cuti bersama mengurangi hari kerja di sprint yang terkena, dan tanggal
				selesai bisa dihitung. Kosongkan untuk estimasi tanpa tanggal.
			</p>
		</div>
		<label class="field mulai">
			<span class="field-label">Rencana mulai</span>
			<input type="date" bind:value={ed.plannedStart} disabled={ed.locked} onchange={(e) => (ed.plannedStart = e.currentTarget.value || null)} />
			{#if ed.plannedStart && !isMonday(ed.plannedStart)}
				<span class="field-hint">Sprint biasanya dimulai hari Senin.</span>
			{/if}
		</label>
	</div>
	{#if ed.calendar && plan.totalSprints > 0}
		<p class="info hasil">
			{date(ed.calendar.start)} – <strong>{date(ed.calendar.endDate(plan.totalSprints))}</strong>
			· {lostDays > 0 ? `${lostDays} hari libur jatuh di hari kerja` : 'tidak ada libur di hari kerja'}
			{#if ed.holidays.length === 0}· <span class="waspada">kalender libur kosong, isi di Pengaturan</span>{/if}
		</p>
	{/if}
</section>

<div class="saran-baris">
	<SuggestTeam {ed} {deadline} />
</div>

<p class="keterangan">
	Kapasitas per orang {decimal(perPerson, 1)} jam per sprint. Jumlah orang boleh desimal (0,5 = paruh waktu). Peran tanpa effort,
	seperti PM, dihitung sebagai alokasi sepanjang proyek.
</p>

<div class="tabel-wadah">
	<table>
		<thead>
			<tr>
				<th>Peran</th>
				<th class="angka">Effort</th>
				<th class="angka kolom-input">Orang (MP)</th>
				<th class="angka kolom-input">Keterlibatan</th>
				<th class="angka">Kapasitas / sprint</th>
				<th class="angka">Sprint</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as r (r.roleId)}
				{@const effort = ed.result.effort.get(r.roleId)?.e ?? 0}
				{@const m = ed.member(r.roleId)}
				{@const sprints = sprintOf(r.roleId)}
				{@const bottleneck = plan.bottleneckRoleId === r.roleId}
				{@const unstaffed = plan.unstaffedRoleIds.includes(r.roleId)}
				<tr class:bottleneck>
					<td>
						<span class="peran">{ed.roleName(r.roleId)}</span>
						{#if bottleneck}<span class="tanda">Bottleneck</span>{/if}
					</td>
					<td class="angka">
						{#if effort > 0}
							{decimal(ed.toUnit(effort), 1)} {ed.unitLabel}
							{#if ed.unit === 'sp'}<span class="sub">{decimal(effort, 1)} jam</span>{/if}
						{:else}
							<span class="redup">–</span>
						{/if}
					</td>
					<td class="kolom-input">
						<NumInput
							value={m?.mp ?? 0}
							onchange={(v) => ed.setMember(r.roleId, { mp: v ?? 0 })}
							placeholder="0"
							suffix="orang"
							disabled={ed.locked}
							invalid={unstaffed}
							label="Jumlah orang {ed.roleName(r.roleId)}"
						/>
					</td>
					<td class="kolom-input">
						<NumInput
							value={m?.months ?? null}
							onchange={(v) => ed.setMember(r.roleId, { months: v })}
							emptyValue={null}
							placeholder="Penuh"
							suffix="bln"
							disabled={ed.locked}
							label="Bulan keterlibatan {ed.roleName(r.roleId)}, kosong berarti sepanjang proyek"
						/>
					</td>
					<td class="angka">
						{#if (m?.mp ?? 0) > 0}
							{decimal(ed.toUnit((m?.mp ?? 0) * perPerson), 1)} {ed.unitLabel}
							{#if ed.unit === 'sp'}<span class="sub">{decimal((m?.mp ?? 0) * perPerson, 1)} jam</span>{/if}
						{:else}
							<span class="redup">–</span>
						{/if}
					</td>
					<td class="angka">
						{#if unstaffed}
							<span class="badge waspada">Belum ada orang</span>
						{:else if effort > 0}
							<strong class:tebal={bottleneck}>{decimal(sprints ?? 0, 2)}</strong>
						{:else}
							<span class="redup">–</span>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
		<tfoot>
			<tr class="total">
				<td>Total</td>
				<td class="angka">{decimal(ed.toUnit(ed.result.totalEffort.e), 1)} {ed.unitLabel}</td>
				<td class="angka">{decimal(ed.team.reduce((a, t) => a + t.mp, 0), 2)} orang</td>
				<td></td>
				<td></td>
				<td class="angka">{plan.devSprints} + {ed.settings.stabilizationSprints} = {plan.totalSprints} sprint</td>
			</tr>
		</tfoot>
	</table>
</div>

<p class="ringkas">
	Sprint pengembangan = sprint peran terlama dibulatkan ke atas ({decimal(plan.devSprintsRaw, 2)} → {plan.devSprints}), ditambah
	{ed.settings.stabilizationSprints} sprint stabilisasi. Durasi {plan.weeks} minggu ≈ {decimal(plan.months, 1)} bulan.
</p>
{#if schedule.length > 0}
	<h3 class="sub-judul">Sprint per tanggal</h3>
	<div class="tabel-wadah">
		<table>
			<thead>
				<tr>
					<th>Sprint</th>
					<th>Tanggal</th>
					<th class="angka">Hari kerja</th>
					<th>Libur</th>
				</tr>
			</thead>
			<tbody>
				{#each schedule as w (w.number)}
					<tr class:berkurang={w.holidays.length > 0}>
						<td>
							{w.number}
							{#if w.number > plan.devSprints}<span class="tanda-stab">Stabilisasi</span>{/if}
						</td>
						<td class="tgl">{date(w.from)} – {date(w.to)}</td>
						<td class="angka">{decimal(w.workingDays, 1)} / {decimal(ed.settings.workDaysPerSprint, 1)}</td>
						<td class="libur">{w.holidays.length ? holidayNames(w.holidays) : '–'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

{#if ed.team.some((t) => t.mp > 1)}
	<p class="ringkas">
		Menambah orang tidak mempercepat secara linear: ada waktu onboarding dan biaya koordinasi. Pertimbangkan cadangan
		lewat contingency.
	</p>
{/if}

<style>
	.jadwal {
		margin-bottom: var(--jarak-6);
	}
	.saran-baris {
		margin-bottom: var(--jarak-4);
	}
	.jadwal-isi {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--jarak-6);
		padding: var(--jarak-4) var(--jarak-6);
	}
	.jadwal-teks h3 {
		display: flex;
		align-items: center;
		gap: var(--jarak-2);
		font-size: var(--teks-isi);
	}
	.jadwal-teks p {
		margin: var(--jarak-1) 0 0;
		max-width: 60ch;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.mulai {
		width: 200px;
		flex: none;
	}
	.hasil {
		margin: 0 var(--jarak-6) var(--jarak-4);
	}
	.waspada {
		color: var(--waspada);
	}
	.sub-judul {
		margin: var(--jarak-8) 0 var(--jarak-3);
		font-size: var(--teks-isi);
	}
	.tgl {
		white-space: nowrap;
	}
	tr.berkurang td.angka {
		color: var(--waspada);
		font-weight: 500;
	}
	.libur {
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.tanda-stab {
		margin-left: var(--jarak-2);
		padding: 1px 6px;
		border-radius: var(--radius-kecil);
		background: color-mix(in srgb, var(--kertas), var(--garis) 50%);
		color: var(--tinta-2);
		font-size: var(--teks-mini);
		font-weight: 500;
	}
	@media (max-width: 767px) {
		.jadwal-isi {
			flex-direction: column;
		}
	}
	.keterangan,
	.ringkas {
		margin: 0 0 var(--jarak-3);
		max-width: 80ch;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.ringkas {
		margin: var(--jarak-3) 0 0;
	}
	.kolom-input {
		width: 150px;
	}
	td.kolom-input {
		padding-top: var(--jarak-2);
		padding-bottom: var(--jarak-2);
	}
	.peran {
		font-weight: 500;
	}
	.tanda {
		margin-left: var(--jarak-2);
		padding: 1px 6px;
		border-radius: var(--radius-kecil);
		background: var(--nila-tipis);
		color: var(--nila);
		font-size: var(--teks-mini);
		font-weight: 500;
	}
	tr.bottleneck td:first-child {
		box-shadow: inset 2px 0 0 var(--nila);
	}
	.tebal {
		color: var(--nila);
	}
	td.angka {
		white-space: nowrap;
	}
	.sub {
		display: block;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.redup {
		color: var(--tinta-2);
	}
	tfoot td {
		border-bottom: 0;
	}
</style>
