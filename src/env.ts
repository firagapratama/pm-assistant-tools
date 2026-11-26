// Variabel lingkungan (SvelteKit 3). Semuanya opsional: tanpa konfigurasi AI, fitur draf AI dinonaktifkan.
import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => (value?.trim() ? value.trim() : undefined);

export const variables = defineEnvVars({
	AI_API_KEY: { schema: optional, description: 'API key penyedia model (endpoint kompatibel OpenAI).' },
	AI_BASE_URL: { schema: optional, description: 'Base URL endpoint chat completions, misalnya https://api.routr.cloud/v1.' },
	MODEL: { schema: optional, description: 'ID model untuk draf estimasi AI.' }
});
