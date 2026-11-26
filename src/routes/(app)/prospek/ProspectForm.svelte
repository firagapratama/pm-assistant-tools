<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import type { Snippet } from 'svelte';

	let {
		action,
		values,
		errors = {},
		clients = [],
		submit,
		actions
	}: {
		action: string;
		values?: Record<string, string>;
		errors?: Record<string, string>;
		clients?: string[];
		submit?: SubmitFunction;
		actions: Snippet;
	} = $props();

	const invalid = (key: string) => (errors[key] ? 'true' : undefined);
	const describedBy = (key: string) => (errors[key] ? `${key}-err` : undefined);
</script>

{#snippet err(key: string)}
	{#if errors[key]}<span class="field-error" id="{key}-err">{errors[key]}</span>{/if}
{/snippet}

<form novalidate method="POST" {action} use:enhance={submit} class="panel">
	<div class="form-bagian">
		<div class="form-bagian-judul">
			<h2>Prospek</h2>
			<p>Nama calon proyek dan pihak yang meminta.</p>
		</div>
		<div class="field-grid">
			<label class="field penuh">
				<span class="field-label">Nama prospek</span>
				<input
					name="name"
					value={values?.name ?? ''}
					required
					placeholder="Aplikasi Kasir Toko Maju"
					aria-invalid={invalid('name')}
					aria-describedby={describedBy('name')}
				/>
				{@render err('name')}
			</label>
			<label class="field">
				<span class="field-label">Klien atau unit bisnis <span class="opsional">· opsional</span></span>
				<input name="client" value={values?.client ?? ''} list="daftar-klien" autocomplete="off" placeholder="PT Toko Maju" />
				<datalist id="daftar-klien">
					{#each clients as c (c)}<option value={c}></option>{/each}
				</datalist>
				{@render err('client')}
			</label>
			<label class="field">
				<span class="field-label">Kontak <span class="opsional">· opsional</span></span>
				<input name="contact" value={values?.contact ?? ''} placeholder="Nama, email, atau nomor" />
				{@render err('contact')}
			</label>
		</div>
	</div>

	<div class="form-bagian">
		<div class="form-bagian-judul">
			<h2>Batasan klien</h2>
			<p>Opsional. Dipakai sebagai pembanding saat estimasi selesai dihitung.</p>
		</div>
		<div class="field-grid">
			<label class="field">
				<span class="field-label">Tenggat yang diminta</span>
				<input
					name="deadline"
					type="date"
					value={values?.deadline ?? ''}
					aria-invalid={invalid('deadline')}
					aria-describedby={describedBy('deadline')}
				/>
				{@render err('deadline')}
			</label>
			<label class="field">
				<span class="field-label">Batas anggaran</span>
				<span class="input-grup">
					<span class="affix">Rp</span>
					<input
						name="budget"
						inputmode="numeric"
						class="angka"
						value={values?.budget ?? ''}
						placeholder="400.000.000"
						aria-invalid={invalid('budget')}
						aria-describedby={describedBy('budget')}
					/>
				</span>
				{@render err('budget')}
			</label>
		</div>
	</div>

	<div class="form-bagian">
		<div class="form-bagian-judul">
			<h2>Kebutuhan</h2>
			<p>Ringkasan yang nanti dipecah menjadi daftar fitur di estimasi.</p>
		</div>
		<div class="field-grid">
			<label class="field penuh">
				<span class="field-label">Ringkasan kebutuhan</span>
				<textarea name="needs" rows="3" placeholder="Apa yang ingin dibangun, untuk siapa, dan cakupan utamanya">{values?.needs ?? ''}</textarea>
				{@render err('needs')}
			</label>
			<label class="field penuh">
				<span class="field-label">Tujuan bisnis</span>
				<textarea name="businessGoal" rows="2" placeholder="Hasil yang diharapkan klien, misalnya mempercepat transaksi kasir">{values?.businessGoal ?? ''}</textarea>
				{@render err('businessGoal')}
			</label>
			<label class="field penuh">
				<span class="field-label">Catatan <span class="opsional">· opsional</span></span>
				<textarea name="notes" rows="2">{values?.notes ?? ''}</textarea>
				{@render err('notes')}
			</label>
		</div>
	</div>

	<div class="form-kaki">{@render actions()}</div>
</form>
