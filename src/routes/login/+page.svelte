<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let pending = $state(false);
</script>

<svelte:head><title>Masuk · PM Workspace</title></svelte:head>

<main>
	<p class="wordmark">PM Workspace</p>

	<form
		novalidate
		method="POST"
		class="panel"
		use:enhance={() => {
			pending = true;
			return async ({ update }) => {
				await update();
				pending = false;
			};
		}}
	>
		<div class="kepala">
			<h1>Masuk</h1>
			<p>Estimasi dan pemantauan proyek dalam satu tempat.</p>
		</div>

		<label class="field">
			<span class="field-label">Nama pengguna</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input name="username" autocomplete="username" required autofocus value={form?.username ?? ''} />
		</label>
		<label class="field">
			<span class="field-label">Password</span>
			<input name="password" type="password" autocomplete="current-password" required />
		</label>

		{#if form?.message}
			<p class="pesan-error" role="alert">{form.message}</p>
		{/if}

		<button class="btn primer" disabled={pending}>{pending ? 'Memeriksa…' : 'Masuk'}</button>
	</form>
</main>

<style>
	main {
		min-height: 100vh;
		display: grid;
		place-content: center;
		gap: var(--jarak-6);
		padding: var(--jarak-6) var(--jarak-4);
	}
	.wordmark {
		margin: 0;
		font-weight: 600;
		font-size: 16px;
		text-align: center;
	}
	form {
		width: min(380px, calc(100vw - 32px));
		display: grid;
		gap: var(--jarak-4);
		padding: var(--jarak-8);
	}
	.kepala {
		margin-bottom: var(--jarak-2);
	}
	h1 {
		font-size: var(--teks-h3);
	}
	.kepala p {
		margin: var(--jarak-1) 0 0;
		font-size: var(--teks-kecil);
		color: var(--tinta-2);
	}
	.btn {
		width: 100%;
		height: 40px;
		margin-top: var(--jarak-2);
	}
</style>
