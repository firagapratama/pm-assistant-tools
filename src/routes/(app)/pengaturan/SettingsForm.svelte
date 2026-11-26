<script lang="ts">
	import { enhance } from '$app/forms';
	import type { EstimateSettings } from '#lib/calc/settings.ts';
	import ParameterFields from '#lib/components/ParameterFields.svelte';
	import { withToast } from '#lib/components/enhance.ts';
	import { settingsToText } from '#lib/settings-text.ts';

	let { settings, errors = {} }: { settings: EstimateSettings; errors?: Record<string, string> } = $props();

	// svelte-ignore state_referenced_locally — nilai awal saja; form tidak di-reset setelah simpan.
	let f = $state(settingsToText(settings));
</script>

<form novalidate method="POST" action="?/saveSettings" use:enhance={withToast()} class="panel">
	<ParameterFields bind:f {errors} />
	<div class="form-kaki">
		<span class="field-hint">Berlaku untuk estimasi baru. Estimasi yang sudah ada menyimpan parameternya sendiri.</span>
		<button class="btn primer">Simpan parameter</button>
	</div>
</form>
