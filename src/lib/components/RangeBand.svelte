<script lang="ts">
	// Pita rentang (design.md 1.3): O–P tipis, ±σ sedang, penanda E 2px. Tidak pernah diberi warna status.
	let {
		o,
		lo,
		e,
		hi,
		p,
		size = 'sedang',
		max,
		format,
		label
	}: {
		o: number;
		lo: number;
		e: number;
		hi: number;
		p: number;
		size?: 'besar' | 'sedang' | 'mini';
		/** Ujung kanan skala bersama (pita mini antarbaris); default P. */
		max?: number;
		format?: (n: number) => string;
		label: string;
	} = $props();

	let d0 = $derived(max !== undefined ? 0 : o);
	let d1 = $derived(max !== undefined ? max : p);
	let span = $derived(d1 - d0 || 1);
	const pos = (x: number) => Math.min(100, Math.max(0, ((x - d0) / span) * 100));
	let flat = $derived(max === undefined && p === o);
</script>

<div class="pita {size}" role="img" aria-label={label}>
	<div class="jalur">
		{#if !flat}
			<span class="penuh" style:left="{pos(o)}%" style:width="{pos(p) - pos(o)}%"></span>
			<span class="sigma" style:left="{pos(lo)}%" style:width="{pos(hi) - pos(lo)}%"></span>
		{/if}
		<span class="e" style:left="{flat ? 50 : pos(e)}%"></span>
	</div>
	{#if size === 'besar' && format && !flat}
		<div class="ujung">
			<span>O {format(o)}</span>
			<span>P {format(p)}</span>
		</div>
	{/if}
</div>

<style>
	.pita {
		width: 100%;
	}
	.jalur {
		position: relative;
		height: 10px;
	}
	.besar .jalur {
		height: 14px;
	}
	.mini .jalur {
		height: 6px;
	}
	span.penuh,
	span.sigma,
	span.e {
		position: absolute;
		top: 0;
		bottom: 0;
		transition: left var(--durasi-cepat) ease-out, width var(--durasi-cepat) ease-out;
	}
	.penuh {
		background: var(--nila-tipis);
		border-radius: 3px;
	}
	.sigma {
		background: var(--nila-sedang);
		border-radius: 3px;
	}
	.e {
		width: 2px;
		margin-left: -1px;
		top: -3px !important;
		bottom: -3px !important;
		background: var(--nila);
		border-radius: 1px;
	}
	.mini .e {
		top: -2px !important;
		bottom: -2px !important;
	}
	.ujung {
		display: flex;
		justify-content: space-between;
		margin-top: var(--jarak-1);
		font-size: var(--teks-mini);
		color: var(--tinta-2);
		font-variant-numeric: tabular-nums;
	}
	@media print {
		/* Tetap terbaca hitam-putih: arsiran berbeda, bukan hanya beda warna. */
		.penuh {
			background: repeating-linear-gradient(45deg, #bbb 0 1px, transparent 1px 4px);
		}
		.sigma {
			background: repeating-linear-gradient(45deg, #555 0 1.5px, transparent 1.5px 3px);
		}
		.e {
			background: #000;
		}
	}
</style>
