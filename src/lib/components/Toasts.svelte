<script lang="ts">
	import { X } from '@lucide/svelte';
	import { dismiss, toasts } from './toast.svelte.ts';
</script>

<div class="wadah" aria-live="polite">
	{#each toasts as t (t.id)}
		<div class="toast" class:error={t.kind === 'error'} role={t.kind === 'error' ? 'alert' : 'status'}>
			<span>{t.text}</span>
			{#if t.action}
				<button
					class="btn teks aksi"
					onclick={() => {
						t.action?.run();
						dismiss(t.id);
					}}>{t.action.label}</button
				>
			{/if}
			<button class="btn teks" aria-label="Tutup" onclick={() => dismiss(t.id)}>
				<X size={16} strokeWidth={1.5} />
			</button>
		</div>
	{/each}
</div>

<style>
	.wadah {
		position: fixed;
		right: var(--jarak-6);
		bottom: var(--jarak-6);
		display: grid;
		gap: var(--jarak-2);
		z-index: 10;
	}
	.toast {
		display: flex;
		align-items: center;
		gap: var(--jarak-3);
		padding: var(--jarak-2) var(--jarak-2) var(--jarak-2) var(--jarak-4);
		border-radius: var(--radius-panel);
		background: var(--tinta);
		color: var(--permukaan);
		box-shadow: var(--bayangan-melayang);
	}
	.toast .btn {
		color: inherit;
		height: 28px;
	}
	.toast .aksi {
		color: var(--nila-sedang);
		font-weight: 600;
	}
	.toast .btn:hover {
		background: rgba(255, 255, 255, 0.12);
	}
	.toast.error {
		background: var(--kritis-tipis);
		color: var(--kritis);
		border: 1px solid var(--kritis);
	}
</style>
