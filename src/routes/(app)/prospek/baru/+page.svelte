<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import ProspectForm from '../ProspectForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Prospek baru · PM Workspace</title></svelte:head>

<div class="lebar-baca">
	<a class="kembali" href="/prospek"><ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" /> Prospek</a>

	<header class="halaman-kepala">
		<div>
			<h1>Prospek baru</h1>
			<p>Catat calon proyek. Estimasi dibuat setelah prospek tersimpan.</p>
		</div>
	</header>

	<ProspectForm action="" values={form?.values} errors={form?.errors} clients={data.clients}>
		{#snippet actions()}
			<a class="btn teks" href="/prospek">Batal</a>
			<button class="btn primer">Simpan prospek</button>
		{/snippet}
	</ProspectForm>
</div>

<style>
	.lebar-baca {
		max-width: 960px;
	}
</style>
