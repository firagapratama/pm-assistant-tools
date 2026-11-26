import { db } from '#lib/server/db/index.ts';
import { aiEnvConfig, aiProvider } from '#lib/server/estimate-context.ts';
import { formOf } from '#lib/server/form.ts';
import { getAiEnabled, listAiCalls, setAiEnabled } from '#lib/server/master.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const env = aiEnvConfig();
	return {
		enabled: getAiEnabled(db),
		// Hanya penyedia dan model yang ditampilkan; API key tidak pernah dikirim ke browser.
		env: env ? { provider: aiProvider(env), model: env.model } : null,
		calls: listAiCalls(db, 30)
	};
};

export const actions: Actions = {
	toggle: async ({ request }) => {
		const on = (await formOf(request)).enabled === 'true';
		setAiEnabled(db, on);
		return { message: on ? 'Draf AI dinyalakan' : 'Draf AI dimatikan' };
	}
};
