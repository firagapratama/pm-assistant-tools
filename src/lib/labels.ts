// Label tampilan untuk nilai enum di database.

export const LEVELS = ['junior', 'mid', 'senior'] as const;
export const SOURCES = ['internal', 'vendor'] as const;
export type Level = (typeof LEVELS)[number];
export type Source = (typeof SOURCES)[number];

export const LEVEL_LABEL: Record<Level, string> = { junior: 'Junior', mid: 'Mid', senior: 'Senior' };
export const SOURCE_LABEL: Record<Source, string> = { internal: 'Internal', vendor: 'Vendor' };

/** "Backend · Senior · Vendor" — sumber Internal tidak ditulis karena default. */
export function roleLabel(r: { name: string; level: string | null; source: string }): string {
	const parts = [r.name];
	if (r.level) parts.push(LEVEL_LABEL[r.level as Level] ?? r.level);
	if (r.source === 'vendor') parts.push(SOURCE_LABEL.vendor);
	return parts.join(' · ');
}

export const PROSPECT_STATUSES = ['prospek', 'estimasi', 'proposal', 'negosiasi', 'deal', 'batal'] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

/** PRD 5.1 */
export const STATUS_LABEL: Record<ProspectStatus, string> = {
	prospek: 'Prospek',
	estimasi: 'Estimasi',
	proposal: 'Proposal dikirim',
	negosiasi: 'Negosiasi',
	deal: 'Deal',
	batal: 'Batal'
};

/** Peran standar dari PRD F1, untuk mengisi awal. */
export const STANDARD_ROLES = ['UI/UX', 'Frontend', 'Backend', 'Mobile', 'QA', 'DevOps', 'PM'];
