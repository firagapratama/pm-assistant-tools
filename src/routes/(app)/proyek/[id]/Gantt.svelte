<script lang="ts">
	// Gantt aktivitas & milestone (kick-off, sprint, SIT, UAT, go-live, ...).
	// Progres fitur ada di tabel "Ubah jadwal & progres"; status hanya ditampilkan dengan ikon + teks.
	import { TriangleAlert } from '@lucide/svelte';
	import type { SprintWindow } from '#lib/calc/calendar.ts';
	import { addDays, isWeekday } from '#lib/calc/calendar.ts';
	import { date } from '#lib/format/index.ts';

	export interface GanttActivity {
		id: number;
		name: string;
		kind: 'aktivitas' | 'milestone';
		startDate: string;
		endDate: string;
		done: boolean;
		flag: 'terlambat' | null;
	}

	let {
		activities,
		windows,
		today,
		onselect
	}: {
		activities: GanttActivity[];
		/** Sprint 1..n (cukup panjang untuk aktivitas terjauh). */
		windows: SprintWindow[];
		today: string;
		onselect?: (id: number) => void;
	} = $props();

	const DAY = 86_400_000;
	const ms = (iso: string) => Date.parse(iso + 'T00:00:00Z');
	let start = $derived(windows[0].from);
	let endExclusive = $derived(addDays(windows.at(-1)!.to, 1));
	let days = $derived((ms(endExclusive) - ms(start)) / DAY);
	const pct = (iso: string) => ((ms(iso) - ms(start)) / DAY / days) * 100;
	const dateStyle = (from: string, to: string) => {
		const a = pct(from);
		return `left:${a}%;width:${pct(addDays(to, 1)) - a}%`;
	};
	let showToday = $derived(today >= start && today < endExclusive);
	let holidays = $derived(windows.flatMap((w) => w.holidays).filter((h) => isWeekday(h.date)));

	let tip: { act: GanttActivity; x: number; y: number } | null = $state(null);
	function showTip(act: GanttActivity, e: Event) {
		const el = e.currentTarget as HTMLElement;
		const box = el.getBoundingClientRect();
		const host = el.closest('.gantt')!.getBoundingClientRect();
		tip = { act, x: box.left - host.left + Math.min(Math.max(box.width, 12), 220) / 2, y: box.top - host.top };
	}
	const when = (a: GanttActivity) => (a.kind === 'milestone' ? date(a.startDate) : `${date(a.startDate)} – ${date(a.endDate)}`);
	const statusText = (a: GanttActivity) => (a.done ? 'selesai' : a.flag === 'terlambat' ? 'terlambat' : 'belum selesai');
</script>

<div class="gantt" role="figure" aria-label="Gantt aktivitas dan milestone proyek; rincian lengkap ada di tabel Ubah jadwal">
	<div class="legenda" aria-hidden="true">
		<span><i class="kunci aktivitas-kunci"></i>Aktivitas</span>
		<span><i class="kunci selesai"></i>Selesai</span>
		<span><i class="kunci milestone"></i>Milestone</span>
		<span><i class="kunci libur"></i>Libur</span>
		{#if showToday}<span><i class="kunci hariini"></i>Hari ini</span>{/if}
	</div>

	<div class="gulir">
		<div class="kisi" style:--hari={days}>
			<div class="label kepala">Aktivitas &amp; milestone</div>
			<div class="waktu kepala">
				{#each windows as w (w.number)}
					<div class="sprint-kepala" class:genap={w.number % 2 === 0} style={dateStyle(w.from, w.to)}>
						<strong>S{w.number}</strong>
						<span>{date(w.from).replace(/ \d{4}$/, '')}</span>
					</div>
				{/each}
			</div>

			<div class="label badan">
				{#each activities as a (a.id)}
					<div class="baris-label">
						<span class="nama" class:selesai-teks={a.done} title={a.name}>{a.kind === 'milestone' ? '◆ ' : ''}{a.name}</span>
						{#if a.flag === 'terlambat'}
							<span class="flag"><TriangleAlert size={12} strokeWidth={2} aria-hidden="true" />Terlambat</span>
						{/if}
					</div>
				{/each}
			</div>

			<div class="waktu badan">
				{#each windows as w (w.number)}
					<div class="pita" class:genap={w.number % 2 === 0} style={dateStyle(w.from, w.to)}></div>
				{/each}
				{#each holidays as h (h.date)}
					<div class="hari-libur" style="left:{pct(h.date)}%;width:{100 / days}%" title="{date(h.date)}: {h.name}"></div>
				{/each}
				{#if showToday}
					<div class="hari-ini" style="left:{pct(today)}%"><span>Hari ini</span></div>
				{/if}

				{#each activities as a (a.id)}
					<div class="baris">
						<button
							class="aktivitas"
							class:milestone={a.kind === 'milestone'}
							class:selesai={a.done}
							style={a.kind === 'milestone'
								? `left:clamp(7px, ${pct(a.startDate) + 50 / days}%, calc(100% - 7px))`
								: dateStyle(a.startDate, a.endDate)}
							aria-label="{a.name}: {when(a)}, {statusText(a)}"
							onpointerenter={(e) => showTip(a, e)}
							onpointerleave={() => (tip = null)}
							onfocus={(e) => showTip(a, e)}
							onblur={() => (tip = null)}
							onclick={() => onselect?.(a.id)}
						></button>
					</div>
				{/each}
			</div>
		</div>
	</div>

	{#if tip}
		<div class="tooltip" style="left:{tip.x}px;top:{tip.y}px" role="tooltip">
			<strong>{when(tip.act)}</strong>
			<span class="t-nama">{tip.act.name}</span>
			<span class="redup">{tip.act.kind === 'milestone' ? 'Milestone' : 'Aktivitas'} · {statusText(tip.act)}</span>
		</div>
	{/if}
</div>

<style>
	.gantt {
		position: relative;
		--tinggi-baris: 36px;
		--lebar-label: 240px;
		--aktivitas: #7a8396;
		--selesai: var(--nila);
	}
	.legenda {
		display: flex;
		flex-wrap: wrap;
		gap: var(--jarak-2) var(--jarak-4);
		margin-bottom: var(--jarak-3);
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.legenda span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.kunci {
		display: inline-block;
		width: 16px;
		height: 10px;
		border-radius: 3px;
	}
	.kunci.aktivitas-kunci { background: var(--aktivitas); }
	.kunci.selesai { background: var(--selesai); }
	.kunci.milestone {
		width: 9px;
		height: 9px;
		margin: 0 2px;
		border-radius: 1px;
		transform: rotate(45deg);
		background: var(--tinta);
	}
	.kunci.libur {
		background: repeating-linear-gradient(45deg, var(--garis) 0 2px, transparent 2px 5px);
	}
	.kunci.hariini {
		width: 2px;
		height: 14px;
		border-radius: 1px;
		background: var(--tinta);
	}
	.gulir {
		overflow-x: auto;
		border: 1px solid var(--garis);
		border-radius: var(--radius-panel);
		background: var(--permukaan);
	}
	.kisi {
		display: grid;
		grid-template-columns: var(--lebar-label) minmax(calc(var(--hari) * 9px), 1fr);
		min-width: 100%;
	}
	.label {
		position: sticky;
		left: 0;
		z-index: 2;
		background: var(--permukaan);
		border-right: 1px solid var(--garis);
	}
	.kepala {
		height: 44px;
		border-bottom: 1px solid var(--garis);
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.label.kepala {
		display: flex;
		align-items: center;
		padding: 0 var(--jarak-4);
		font-weight: 500;
	}
	.waktu {
		position: relative;
	}
	.badan {
		padding: var(--jarak-1) 0;
	}
	.sprint-kepala {
		position: absolute;
		top: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 0 var(--jarak-2);
		border-left: 1px solid var(--garis);
		white-space: nowrap;
		overflow: hidden;
		font-variant-numeric: tabular-nums;
	}
	.sprint-kepala strong {
		color: var(--tinta);
		font-weight: 600;
	}
	.sprint-kepala span {
		font-size: var(--teks-mini);
	}
	.baris-label,
	.baris {
		height: var(--tinggi-baris);
	}
	.baris-label {
		display: flex;
		align-items: center;
		gap: var(--jarak-2);
		padding: 0 var(--jarak-4);
		font-size: var(--teks-kecil);
		min-width: 0;
	}
	.nama {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.selesai-teks {
		color: var(--tinta-2);
	}
	.flag {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		flex: none;
		padding: 1px 5px;
		border-radius: var(--radius-kecil);
		font-size: var(--teks-mini);
		font-weight: 500;
		background: var(--kritis-tipis);
		color: var(--kritis);
	}
	.baris {
		position: relative;
	}
	.pita {
		position: absolute;
		top: 0;
		bottom: 0;
		border-left: 1px solid var(--garis);
	}
	.pita.genap,
	.sprint-kepala.genap {
		background: color-mix(in srgb, var(--kertas) 55%, var(--permukaan));
	}
	.hari-libur {
		position: absolute;
		top: 0;
		bottom: 0;
		min-width: 3px;
		background: repeating-linear-gradient(45deg, var(--garis) 0 2px, transparent 2px 5px);
	}
	.hari-ini {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		margin-left: -1px;
		background: var(--tinta);
		z-index: 1;
		pointer-events: none;
	}
	.hari-ini span {
		position: absolute;
		top: 2px;
		left: 4px;
		padding: 0 4px;
		border-radius: 3px;
		background: var(--tinta);
		color: var(--permukaan);
		font-size: var(--teks-mini);
		white-space: nowrap;
	}
	.aktivitas {
		position: absolute;
		top: 10px;
		height: 16px;
		padding: 0;
		border: 0;
		border-radius: 4px;
		background: var(--aktivitas);
		cursor: pointer;
		transition: filter var(--transisi);
	}
	/* Area sentuh lebih besar dari batang. */
	.aktivitas::before {
		content: '';
		position: absolute;
		inset: -10px -6px;
	}
	.aktivitas.selesai {
		background: var(--selesai);
	}
	.aktivitas.milestone {
		width: 12px;
		height: 12px;
		top: 12px;
		margin-left: -6px;
		border-radius: 2px;
		transform: rotate(45deg);
		background: var(--tinta);
	}
	.aktivitas.milestone.selesai {
		background: var(--selesai);
	}
	.aktivitas:hover,
	.aktivitas:focus-visible {
		filter: brightness(0.9);
	}
	.tooltip {
		position: absolute;
		z-index: 5;
		transform: translate(-50%, calc(-100% - 8px));
		display: grid;
		gap: 2px;
		min-width: 160px;
		max-width: 280px;
		padding: var(--jarak-2) var(--jarak-3);
		border-radius: var(--radius-kecil);
		background: var(--permukaan);
		border: 1px solid var(--garis);
		box-shadow: var(--bayangan-melayang);
		font-size: var(--teks-kecil);
		pointer-events: none;
	}
	.tooltip strong {
		font-size: var(--teks-isi);
		font-variant-numeric: tabular-nums;
	}
	.t-nama {
		font-weight: 500;
	}
	.redup {
		color: var(--tinta-2);
	}
	@media (max-width: 767px) {
		.gantt {
			--lebar-label: 150px;
		}
	}
</style>
