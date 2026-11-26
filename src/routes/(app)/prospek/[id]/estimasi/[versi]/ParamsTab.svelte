<script lang="ts">
	import * as v from 'valibot';
	import ParameterFields from '#lib/components/ParameterFields.svelte';
	import { settingsToText } from '#lib/settings-text.ts';
	import { SettingsSchema, fieldErrors } from '#lib/validation/master.ts';
	import type { EstimateEditor } from './editor.svelte.ts';

	let { ed }: { ed: EstimateEditor } = $props();

	// svelte-ignore state_referenced_locally — teks diinisialisasi sekali dari parameter estimasi.
	let f = $state(settingsToText(ed.settings));
	let errors: Record<string, string> = $state({});

	/** Hanya parameter yang valid yang diterapkan ke perhitungan. */
	function apply() {
		const r = v.safeParse(SettingsSchema, $state.snapshot(f));
		if (r.success) {
			errors = {};
			ed.settings = r.output;
		} else {
			errors = fieldErrors(r.issues);
		}
	}
</script>

<p class="keterangan">
	Parameter ini milik estimasi versi ini saja. Mengubah satuan input tidak mengubah nilai yang sudah diisi; angka hanya
	ditampilkan dalam satuan baru.
</p>

<div class="panel">
	<ParameterFields bind:f {errors} disabled={ed.locked} oninput={apply} />
</div>

<div class="panel teks">
	<div class="form-bagian">
		<div class="form-bagian-judul">
			<h3>Asumsi, batasan, dan risiko</h3>
			<p>Tampil di ringkasan direksi agar angka tidak dibaca sebagai janji tanpa syarat.</p>
		</div>
		<div class="isian">
			<label class="field">
				<span class="field-label">Asumsi utama</span>
				<textarea rows="4" bind:value={ed.assumptions} disabled={ed.locked} placeholder="Satu asumsi per baris, misalnya: API pembayaran disediakan klien"></textarea>
			</label>
			<label class="field">
				<span class="field-label">Tidak termasuk</span>
				<textarea rows="3" bind:value={ed.exclusions} disabled={ed.locked} placeholder="Misalnya: migrasi data lama, pelatihan pengguna"></textarea>
			</label>
			<label class="field">
				<span class="field-label">Risiko utama</span>
				<textarea rows="3" bind:value={ed.risks} disabled={ed.locked} placeholder="Satu risiko per baris, yang terpenting di atas. Tiga teratas tampil di ringkasan direksi."></textarea>
			</label>
		</div>
	</div>
</div>

<style>
	.keterangan {
		margin: 0 0 var(--jarak-3);
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.teks {
		margin-top: var(--jarak-6);
	}
	.isian {
		display: grid;
		gap: var(--jarak-4);
	}
</style>
