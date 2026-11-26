<script lang="ts">
	// Input angka format Indonesia. Selama fokus, teks yang diketik dipertahankan apa adanya;
	// di luar fokus, nilai ditampilkan rapi. Nilai dikirim ke luar lewat onchange.
	import { decimal, parseNumber } from '#lib/format/index.ts';

	let {
		value,
		onchange,
		toDisplay = (n: number) => n,
		fromDisplay = (n: number) => n,
		digits = 2,
		emptyValue = 0,
		suffix,
		prefix,
		placeholder,
		disabled = false,
		invalid = false,
		label,
		min = 0,
		...rest
	}: {
		value: number | null;
		onchange: (v: number | null) => void;
		toDisplay?: (n: number) => number;
		fromDisplay?: (n: number) => number;
		digits?: number;
		/** Nilai saat input dikosongkan (0 atau null). */
		emptyValue?: number | null;
		suffix?: string;
		prefix?: string;
		placeholder?: string;
		disabled?: boolean;
		invalid?: boolean;
		label: string;
		min?: number;
		[key: string]: unknown;
	} = $props();

	let editing = $state(false);
	let text = $state('');
	let bad = $state(false);

	const show = (v: number | null) => (v === null || (v === 0 && emptyValue === 0) ? '' : decimal(toDisplay(v), digits));

	function oninput(e: Event) {
		text = (e.currentTarget as HTMLInputElement).value;
		if (text.trim() === '') {
			bad = false;
			onchange(emptyValue);
			return;
		}
		const n = parseNumber(text);
		bad = !Number.isFinite(n) || n < min;
		if (!bad) onchange(fromDisplay(n));
	}
</script>

<span class="input-grup num" class:tanpa-affix={!suffix && !prefix}>
	{#if prefix}<span class="affix">{prefix}</span>{/if}
	<input
		{...rest}
		class="angka"
		inputmode="decimal"
		autocomplete="off"
		value={editing ? text : show(value)}
		{placeholder}
		{disabled}
		aria-label={label}
		aria-invalid={invalid || bad ? 'true' : undefined}
		onfocus={() => {
			editing = true;
			text = show(value);
		}}
		onblur={() => {
			editing = false;
			bad = false;
		}}
		{oninput}
	/>
	{#if suffix}<span class="affix">{suffix}</span>{/if}
</span>

<style>
	.num {
		height: 36px;
	}
	.num input {
		padding: 0 var(--jarak-2);
	}
	.num input:disabled {
		color: var(--tinta);
		cursor: default;
	}
	.num:has(input:disabled) {
		background: transparent;
		border-color: transparent;
	}
</style>
