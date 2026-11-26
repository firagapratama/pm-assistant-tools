// Menyorot elemen sebentar saat nilainya berubah (design.md 8.2).
export function sorot(node: HTMLElement, value: unknown) {
	let last = value;
	return {
		update(next: unknown) {
			if (next === last) return;
			last = next;
			node.classList.remove('sorot');
			void node.offsetWidth; // mulai ulang animasi
			node.classList.add('sorot');
		}
	};
}
