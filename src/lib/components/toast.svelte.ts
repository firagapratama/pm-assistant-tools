// Toast (design.md 6.6): kanan bawah, hilang setelah 4 detik kecuali error; aksi opsional ("Urungkan").
export interface Toast {
	id: number;
	text: string;
	kind: 'info' | 'error';
	action?: { label: string; run: () => void };
}

export const toasts: Toast[] = $state([]);
let nextId = 0;

export function dismiss(id: number) {
	const i = toasts.findIndex((t) => t.id === id);
	if (i >= 0) toasts.splice(i, 1);
}

export function toast(text: string, kind: Toast['kind'] = 'info', action?: Toast['action']) {
	const id = ++nextId;
	toasts.push({ id, text, kind, action });
	if (kind !== 'error') setTimeout(() => dismiss(id), action ? 6000 : 4000);
}
