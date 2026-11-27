<script lang="ts">
	// Ketersediaan tim: cuti dan sakit mengurangi kapasitas, lembur menambah; dampaknya menggeser proyeksi selesai.
	import { Plus, Trash2, UserRoundX } from '@lucide/svelte';
	import { AVAILABILITY_KINDS, AVAILABILITY_LABEL, type AvailabilityKind } from '#lib/availability.ts';
	import { date, decimal } from '#lib/format/index.ts';

	interface Item {
		id: number;
		roleId: number;
		kind: AvailabilityKind;
		people: number;
		startDate: string;
		endDate: string;
		hours: number;
		note: string;
	}

	let {
		items,
		team,
		impact,
		today,
		post
	}: {
		items: Item[];
		team: { roleId: number; name: string; mp: number }[];
		impact: { shiftDays: number; byRole: { roleId: number; name: string; lostDays: number; overtimeHours: number; delayDays: number }[] };
		today: string;
		post: (action: string, fields: Record<string, string | number | boolean>) => Promise<Record<string, unknown> | null | undefined>;
	} = $props();

	const BADGE: Record<AvailabilityKind, string> = { cuti: 'waspada', sakit: 'kritis', lembur: 'aman' };
	const roleName = (id: number) => team.find((t) => t.roleId === id)?.name ?? `Peran #${id}`;

	let adding = $state(false);
	let saving = $state(false);
	let form = $state({ roleId: '', kind: 'cuti' as AvailabilityKind, people: '1', startDate: '', endDate: '', hours: '2', note: '' });

	function start() {
		adding = true;
		form = { roleId: String(team.find((t) => t.mp > 0)?.roleId ?? ''), kind: 'cuti', people: '1', startDate: today, endDate: today, hours: '2', note: '' };
	}

	async function save() {
		saving = true;
		const res = await post('saveAvailability', { ...form, people: form.people.replace(',', '.'), hours: form.hours.replace(',', '.') });
		saving = false;
		if (res) adding = false;
	}
</script>

<section class="panel ketersediaan" aria-labelledby="tersedia-judul">
	<div class="kepala">
		<div>
			<h2 id="tersedia-judul">Ketersediaan tim</h2>
			<p>Cuti dan sakit mengurangi kapasitas peran; lembur menambahnya. Proyeksi selesai ikut bergeser.</p>
		</div>
		{#if !adding}<button class="btn kecil" onclick={start}><Plus size={14} strokeWidth={2} aria-hidden="true" /> Catat cuti / sakit / lembur</button>{/if}
	</div>

	{#if impact.byRole.length}
		<p class="dampak" class:mundur={impact.shiftDays > 0} class:maju={impact.shiftDays < 0}>
			{#if impact.shiftDays > 0}
				Proyeksi selesai mundur <strong>{impact.shiftDays} hari kerja</strong>
			{:else if impact.shiftDays < 0}
				Proyeksi selesai maju <strong>{-impact.shiftDays} hari kerja</strong>
			{:else}
				Tidak menggeser jadwal (cuti/sakit tertutup lembur)
			{/if}
			<span class="redup">
				· {impact.byRole
					.map((r) => `${r.name}: ${r.lostDays ? `${decimal(r.lostDays, 1)} orang-hari absen` : ''}${r.lostDays && r.overtimeHours ? ', ' : ''}${r.overtimeHours ? `${decimal(r.overtimeHours, 1)} jam lembur` : ''}`)
					.join(' · ')}
			</span>
		</p>
	{/if}

	{#if adding}
		<div class="form">
			<label class="field">
				<span class="field-label">Peran</span>
				<select bind:value={form.roleId}>
					{#each team as t (t.roleId)}<option value={String(t.roleId)}>{t.name} ({decimal(t.mp, 1)} org)</option>{/each}
				</select>
			</label>
			<label class="field">
				<span class="field-label">Jenis</span>
				<select bind:value={form.kind}>
					{#each AVAILABILITY_KINDS as k (k)}<option value={k}>{AVAILABILITY_LABEL[k]}</option>{/each}
				</select>
			</label>
			<label class="field">
				<span class="field-label">Orang</span>
				<input bind:value={form.people} inputmode="decimal" />
			</label>
			<label class="field">
				<span class="field-label">Dari</span>
				<input type="date" bind:value={form.startDate} />
			</label>
			<label class="field">
				<span class="field-label">Sampai</span>
				<input type="date" bind:value={form.endDate} min={form.startDate} />
			</label>
			{#if form.kind === 'lembur'}
				<label class="field">
					<span class="field-label">Jam per hari</span>
					<input bind:value={form.hours} inputmode="decimal" />
				</label>
			{/if}
			<label class="field catatan">
				<span class="field-label">Catatan <span class="opsional">· opsional</span></span>
				<input bind:value={form.note} maxlength="300" placeholder="Nama orang, alasan, dsb." />
			</label>
			<div class="aksi">
				<button class="btn teks" onclick={() => (adding = false)} disabled={saving}>Batal</button>
				<button class="btn" onclick={save} disabled={saving || !form.roleId || !form.startDate || !form.endDate}>{saving ? 'Menyimpan…' : 'Simpan'}</button>
			</div>
		</div>
	{/if}

	{#if items.length === 0 && !adding}
		<p class="kosong"><UserRoundX size={16} strokeWidth={1.5} aria-hidden="true" /> Belum ada cuti, sakit, atau lembur yang dicatat.</p>
	{:else if items.length}
		<ul class="daftar">
			{#each items as a (a.id)}
				<li class:lewat={a.endDate < today}>
					<span class="badge {BADGE[a.kind]}">{AVAILABILITY_LABEL[a.kind]}</span>
					<span class="isi">
						{roleName(a.roleId)} · {decimal(a.people, 1)} orang{a.kind === 'lembur' ? ` · ${decimal(a.hours, 1)} jam/hari` : ''}
						<span class="redup">{date(a.startDate)}{a.endDate !== a.startDate ? ` – ${date(a.endDate)}` : ''}{a.note ? ` · ${a.note}` : ''}</span>
					</span>
					<button class="btn teks kecil" aria-label="Hapus catatan {AVAILABILITY_LABEL[a.kind]} {roleName(a.roleId)} {date(a.startDate)}" onclick={() => post('deleteAvailability', { id: a.id })}>
						<Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.ketersediaan {
		display: grid;
		gap: var(--jarak-4);
		margin-top: var(--jarak-6);
		padding: var(--jarak-6);
	}
	.kepala {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--jarak-4);
	}
	h2 {
		margin: 0;
		font-size: var(--teks-isi);
	}
	.kepala p {
		margin: 2px 0 0;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.dampak {
		margin: 0;
		padding: var(--jarak-3) var(--jarak-4);
		border-radius: var(--radius-kecil);
		background: var(--nila-tipis);
		font-size: var(--teks-kecil);
	}
	.dampak.mundur {
		background: var(--waspada-tipis);
		color: var(--waspada);
	}
	.dampak.maju {
		background: var(--aman-tipis);
		color: var(--aman);
	}
	.form {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: var(--jarak-3);
		align-items: end;
	}
	.catatan {
		grid-column: span 2;
	}
	.aksi {
		display: flex;
		justify-content: flex-end;
		gap: var(--jarak-2);
		grid-column: 1 / -1;
	}
	.kosong {
		display: flex;
		align-items: center;
		gap: var(--jarak-2);
		margin: 0;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.daftar {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.daftar li {
		display: grid;
		grid-template-columns: 70px minmax(0, 1fr) auto;
		gap: var(--jarak-3);
		align-items: center;
		padding: var(--jarak-2) 0;
		border-top: 1px solid var(--garis);
		font-size: var(--teks-kecil);
	}
	.daftar li:first-child {
		border-top: 0;
	}
	.daftar li.lewat {
		opacity: 0.6;
	}
	.redup {
		margin-left: var(--jarak-2);
		color: var(--tinta-2);
	}
	@media (max-width: 600px) {
		.catatan {
			grid-column: 1 / -1;
		}
	}
</style>
