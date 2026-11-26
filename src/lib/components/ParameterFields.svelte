<script lang="ts">
	import { hoursPerPersonPerSprint } from '#lib/calc/capacity.ts';
	import type { EstimateSettings } from '#lib/calc/settings.ts';
	import { decimal, parseNumber } from '#lib/format/index.ts';
	import type { SettingsText } from '#lib/settings-text.ts';

	let {
		f = $bindable(),
		errors = {},
		disabled = false,
		oninput
	}: { f: SettingsText; errors?: Record<string, string>; disabled?: boolean; oninput?: () => void } = $props();

	const n = (s: string) => parseNumber(s);
	const ok = (x: number) => Number.isFinite(x);
	let perPersonHours = $derived(
		hoursPerPersonPerSprint({
			workDaysPerSprint: n(f.workDaysPerSprint),
			effectiveHoursPerDay: n(f.effectiveHoursPerDay),
			focusFactor: n(f.focusFactor)
		} as EstimateSettings)
	);
	let markup = $derived(n(f.markupBp) / 100);
	let margin = $derived(markup / (1 + markup));
	let months = $derived(n(f.sprintWeeks) / n(f.weeksPerMonth));
</script>

{#snippet field(key: Exclude<keyof SettingsText, 'inputUnit'>, label: string, unit: string, hint?: string)}
	<label class="field">
		<span class="field-label">{label}</span>
		<span class="input-grup">
			<input
				name={key}
				bind:value={f[key]}
				{oninput}
				{disabled}
				inputmode="decimal"
				class="angka"
				aria-invalid={errors[key] ? 'true' : undefined}
				aria-describedby={errors[key] ? `${key}-err` : hint ? `${key}-hint` : undefined}
			/>
			{#if unit}<span class="affix">{unit}</span>{/if}
		</span>
		{#if errors[key]}
			<span class="field-error" id="{key}-err">{errors[key]}</span>
		{:else if hint}
			<span class="field-hint" id="{key}-hint">{hint}</span>
		{/if}
	</label>
{/snippet}

<div class="form-bagian">
	<div class="form-bagian-judul">
		<h3>Satuan estimasi</h3>
		<p>Satuan yang dipakai saat mengisi O/M/P. Perhitungan tetap dilakukan dalam jam.</p>
	</div>
	<div class="isian">
		<label class="field">
			<span class="field-label">Satuan input</span>
			<select name="inputUnit" bind:value={f.inputUnit} onchange={oninput} {disabled}>
				<option value="sp">Story point</option>
				<option value="jam">Jam</option>
			</select>
		</label>
		{@render field(
			'spPerHour',
			'Story point per jam',
			'SP',
			ok(n(f.spPerHour)) && n(f.spPerHour) > 0 ? `1 SP = ${decimal(1 / n(f.spPerHour), 3)} jam` : undefined
		)}
	</div>
</div>

<div class="form-bagian">
	<div class="form-bagian-judul">
		<h3>Sprint dan kapasitas</h3>
		<p>Menentukan berapa jam kerja nyata yang tersedia per orang di setiap sprint.</p>
	</div>
	<div class="isian">
		{@render field('sprintWeeks', 'Panjang sprint', 'minggu')}
		{@render field('workDaysPerSprint', 'Hari kerja per sprint', 'hari')}
		{@render field('effectiveHoursPerDay', 'Jam efektif per hari', 'jam')}
		{@render field('focusFactor', 'Focus factor', '', 'Porsi jam untuk mengerjakan fitur, di luar rapat')}
		{@render field('stabilizationSprints', 'Sprint stabilisasi/UAT', 'sprint')}
		{#if ok(perPersonHours) && ok(n(f.spPerHour))}
			<p class="info penuh" aria-live="polite">
				Kapasitas per orang per sprint
				<strong>{decimal(perPersonHours, 1)} jam</strong> ≈
				<strong>{decimal(perPersonHours * n(f.spPerHour), 1)} SP</strong>
			</p>
		{/if}
	</div>
</div>

<div class="form-bagian">
	<div class="form-bagian-judul">
		<h3>Biaya</h3>
		<p>Contingency untuk ketidakpastian; markup dihitung di atas total biaya.</p>
	</div>
	<div class="isian">
		{@render field('contingencyBp', 'Contingency', '%')}
		{@render field('markupBp', 'Markup', '%', ok(margin) ? `Setara margin ${decimal(margin * 100, 1)}% dari harga jual` : undefined)}
	</div>
</div>

<div class="form-bagian">
	<div class="form-bagian-judul">
		<h3>Lainnya</h3>
		<p>Konversi ke bulan dan lebar rentang di ringkasan direksi.</p>
	</div>
	<div class="isian">
		{@render field('weeksPerMonth', 'Minggu per bulan', 'minggu', ok(months) ? `1 sprint ≈ ${decimal(months, 2)} bulan` : undefined)}
		{@render field('rangeSigma', 'Lebar rentang', '± σ', 'Paling mungkin ± kelipatan σ')}
	</div>
</div>

{#if errors._}<p class="pesan-error kesalahan-umum" role="alert">{errors._}</p>{/if}

<style>
	.isian {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: var(--jarak-4);
		align-items: start;
	}
	.penuh {
		grid-column: 1 / -1;
		margin: 0;
	}
	.kesalahan-umum {
		margin: 0 var(--jarak-6) var(--jarak-6);
	}
</style>
