import type { SubmitFunction } from '$app/forms';
import { toast } from './toast.svelte.ts';

/**
 * `use:enhance` yang menampilkan toast dari `{ message }` hasil action,
 * atau toast error untuk error tak terduga. Error validasi (fail) tampil di form.
 */
export function withToast(opts: { reset?: boolean; onSuccess?: () => void } = {}): SubmitFunction {
	return () =>
		async ({ result, update }) => {
			await update({ reset: opts.reset ?? false });
			if (result.type === 'success') {
				const message = result.data?.message;
				if (typeof message === 'string') toast(message);
				opts.onSuccess?.();
			} else if (result.type === 'error') {
				const message = (result.error as { message?: string } | undefined)?.message;
				toast(message ?? 'Terjadi kesalahan. Muat ulang halaman lalu coba lagi.', 'error');
			}
		};
}
