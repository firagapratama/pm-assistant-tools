<script lang="ts">
	import { page } from '$app/state';

	const items = [
		{ href: '/pengaturan', label: 'Peran & parameter' },
		{ href: '/pengaturan/kalender', label: 'Kalender libur' },
		{ href: '/pengaturan/ai', label: 'Draf AI' }
	];
</script>

<nav class="sub-nav" aria-label="Bagian pengaturan">
	{#each items as item (item.href)}
		<a href={item.href} aria-current={page.url.pathname === item.href ? 'page' : undefined}>{item.label}</a>
	{/each}
</nav>

<style>
	.sub-nav {
		display: flex;
		gap: var(--jarak-1);
		margin: calc(-1 * var(--jarak-4)) 0 var(--jarak-8);
		border-bottom: 1px solid var(--garis);
	}
	a {
		position: relative;
		display: inline-flex;
		align-items: center;
		height: 40px;
		padding: 0 var(--jarak-4);
		color: var(--tinta-2);
		font-weight: 500;
		text-decoration: none;
	}
	a:hover {
		color: var(--tinta);
	}
	a[aria-current='page'] {
		color: var(--nila);
	}
	a[aria-current='page']::after {
		content: '';
		position: absolute;
		left: var(--jarak-2);
		right: var(--jarak-2);
		bottom: -1px;
		height: 2px;
		border-radius: 2px 2px 0 0;
		background: var(--nila);
	}
</style>
