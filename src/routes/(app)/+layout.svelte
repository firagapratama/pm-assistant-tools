<script lang="ts">
	import { page } from '$app/state';
	import { BookOpen, FolderKanban, Inbox, LogOut, Settings } from '@lucide/svelte';
	import Toasts from '#lib/components/Toasts.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const nav = [
		{ href: '/prospek', label: 'Prospek', icon: Inbox },
		{ href: '/proyek', label: 'Proyek', icon: FolderKanban },
		{ href: '/library', label: 'Library', icon: BookOpen }
	];

	const isActive = (href: string) =>
		page.url.pathname === href || page.url.pathname.startsWith(href + '/');
</script>

<div class="kerangka">
	<nav aria-label="Navigasi utama">
		<a class="wordmark" href="/">PM <span>Workspace</span></a>
		<ul>
			{#each nav as item (item.href)}
				<li>
					<a href={item.href} aria-current={isActive(item.href) ? 'page' : undefined}>
						<item.icon size={20} strokeWidth={1.5} aria-hidden="true" />
						<span>{item.label}</span>
					</a>
				</li>
			{/each}
		</ul>
		<ul class="bawah">
			<li>
				<a href="/pengaturan" aria-current={isActive('/pengaturan') ? 'page' : undefined}>
					<Settings size={20} strokeWidth={1.5} aria-hidden="true" />
					<span>Pengaturan</span>
				</a>
			</li>
			<li>
				<form method="POST" action="/logout">
					<button>
						<LogOut size={20} strokeWidth={1.5} aria-hidden="true" />
						<span>Keluar</span>
					</button>
				</form>
			</li>
		</ul>
	</nav>

	<main>
		{@render children()}
	</main>
</div>

<Toasts />

<style>
	.kerangka {
		display: grid;
		grid-template-columns: 224px 1fr;
		min-height: 100vh;
	}

	nav {
		position: sticky;
		top: 0;
		height: 100vh;
		display: flex;
		flex-direction: column;
		padding: var(--jarak-6) 0;
		border-right: 1px solid var(--garis);
		background: var(--kertas);
	}

	.wordmark {
		display: flex;
		gap: 0.3em;
		padding: 0 var(--jarak-6);
		margin-bottom: var(--jarak-8);
		font-weight: 600;
		font-size: 16px;
		color: var(--tinta);
		text-decoration: none;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.bawah {
		margin-top: auto;
		padding-top: var(--jarak-4);
		border-top: 1px solid var(--garis);
	}

	li a,
	li button {
		display: flex;
		align-items: center;
		gap: var(--jarak-3);
		width: 100%;
		min-height: 40px;
		padding: 0 var(--jarak-6);
		border: 0;
		border-left: 2px solid transparent;
		background: none;
		font: inherit;
		color: var(--tinta-2);
		text-decoration: none;
		cursor: pointer;
	}

	li a:hover,
	li button:hover {
		color: var(--tinta);
	}

	li a[aria-current='page'] {
		border-left-color: var(--nila);
		color: var(--nila);
		font-weight: 500;
	}

	main {
		min-width: 0;
		max-width: 1280px;
		padding: var(--jarak-8) var(--jarak-12);
	}

	/* 1024–1279px: sidebar menciut menjadi ikon saja */
	@media (max-width: 1279px) {
		.kerangka {
			grid-template-columns: 64px 1fr;
		}
		.wordmark span,
		li span {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0 0 0 0);
		}
		.wordmark,
		li a,
		li button {
			justify-content: center;
			padding: 0;
		}
		main {
			padding: var(--jarak-8);
		}
	}

	/* < 768px: navigasi menjadi bar atas, satu kolom */
	@media (max-width: 767px) {
		.kerangka {
			grid-template-columns: 1fr;
		}
		nav {
			position: static;
			height: auto;
			flex-direction: row;
			align-items: center;
			padding: var(--jarak-2) var(--jarak-4);
			border-right: 0;
			border-bottom: 1px solid var(--garis);
		}
		.wordmark {
			margin: 0 auto 0 0;
			padding: 0;
		}
		.wordmark span {
			position: static;
			width: auto;
			height: auto;
			overflow: visible;
			clip: auto;
		}
		ul,
		.bawah {
			display: flex;
			margin: 0;
			padding: 0;
			border: 0;
		}
		li a,
		li button {
			width: 44px;
			min-height: 44px;
			border-left: 0;
			border-bottom: 2px solid transparent;
		}
		li a[aria-current='page'] {
			border-bottom-color: var(--nila);
		}
		main {
			padding: var(--jarak-6) var(--jarak-4);
		}
	}
</style>
