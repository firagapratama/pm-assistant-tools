<script lang="ts">
	import Editor from './Editor.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Estimasi v{data.estimate.version} · {data.prospect.name} · PM Workspace</title></svelte:head>

{#key data.estimate.id}
	<Editor {data} />
{/key}
