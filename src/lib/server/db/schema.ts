// Skema PRD bagian 8 (Fase 1 + kebutuhan F9) dan tabel autentikasi.
// Rupiah = integer, persentase = basis poin, effort = jam (real).
import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { EstimateSettings, Holiday, OverheadItem, Priority } from '../../calc';
import { PROSPECT_STATUSES } from '../../labels.ts';
import type { ProjectBaseline } from '../../project.ts';
import type { CrImpact, ThreePointMap } from '../../change-request.ts';
import type { ReportData } from '../../report.ts';

const createdAt = () =>
	integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`);

// ── Autentikasi ────────────────────────────────────────────────

export const users = sqliteTable('users', {
	id: integer('id').primaryKey(),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	createdAt: createdAt()
});

export const sessions = sqliteTable('sessions', {
	/** SHA-256 dari token cookie; token mentah tidak pernah disimpan. */
	id: text('id').primaryKey(),
	userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
});

export const loginAttempts = sqliteTable(
	'login_attempts',
	{
		id: integer('id').primaryKey(),
		ip: text('ip').notNull(),
		success: integer('success', { mode: 'boolean' }).notNull(),
		createdAt: createdAt()
	},
	(t) => [index('login_attempts_ip_time').on(t.ip, t.createdAt)]
);

// ── F1 Master data ─────────────────────────────────────────────

export const roles = sqliteTable('roles', {
	id: integer('id').primaryKey(),
	name: text('name').notNull(),
	level: text('level', { enum: ['junior', 'mid', 'senior'] }),
	source: text('source', { enum: ['internal', 'vendor'] }).notNull().default('internal'),
	active: integer('active', { mode: 'boolean' }).notNull().default(true),
	sortOrder: integer('sort_order').notNull().default(0)
});

export const rateCards = sqliteTable(
	'rate_cards',
	{
		id: integer('id').primaryKey(),
		roleId: integer('role_id').notNull().references(() => roles.id),
		monthlyRate: integer('monthly_rate').notNull(),
		/** YYYY-MM-DD */
		effectiveFrom: text('effective_from').notNull()
	},
	(t) => [uniqueIndex('rate_cards_role_date').on(t.roleId, t.effectiveFrom)]
);

/** Satu baris (id = 1): parameter default untuk estimasi baru. */
export const settings = sqliteTable('settings', {
	id: integer('id').primaryKey(),
	values: text('values', { mode: 'json' }).$type<EstimateSettings>().notNull(),
	/** Saklar draf AI (PRD F4); bila mati, tombol AI tidak ditampilkan. */
	aiEnabled: integer('ai_enabled', { mode: 'boolean' }).notNull().default(true)
});

/** Log pemanggilan AI (PRD F4). Isi teks tidak pernah disimpan. */
export const aiCalls = sqliteTable('ai_calls', {
	id: integer('id').primaryKey(),
	createdAt: createdAt(),
	/** Host penyedia, misalnya api.routr.cloud. */
	provider: text('provider').notNull(),
	model: text('model').notNull(),
	chars: integer('chars').notNull(),
	anonymized: integer('anonymized', { mode: 'boolean' }).notNull(),
	ok: integer('ok', { mode: 'boolean' }).notNull(),
	/** Jumlah fitur yang dihasilkan (0 bila gagal). */
	features: integer('features').notNull().default(0)
});

/** Kalender libur (libur nasional dan cuti bersama), dipakai untuk menghitung hari kerja per sprint. */
export const holidays = sqliteTable('holidays', {
	id: integer('id').primaryKey(),
	/** YYYY-MM-DD; satu tanggal satu entri. */
	date: text('date').notNull().unique(),
	name: text('name').notNull(),
	type: text('type', { enum: ['nasional', 'cuti_bersama'] }).notNull()
});

// ── F3 Library fitur ───────────────────────────────────────────

export const featureTemplates = sqliteTable('feature_templates', {
	id: integer('id').primaryKey(),
	name: text('name').notNull(),
	category: text('category').notNull(),
	complexity: text('complexity', { enum: ['rendah', 'sedang', 'tinggi'] }).notNull().default('sedang'),
	description: text('description').notNull().default(''),
	assumptions: text('assumptions').notNull().default('')
});

export const featureTemplateEfforts = sqliteTable(
	'feature_template_efforts',
	{
		templateId: integer('template_id').notNull().references(() => featureTemplates.id, { onDelete: 'cascade' }),
		roleId: integer('role_id').notNull().references(() => roles.id),
		o: real('o').notNull(),
		m: real('m').notNull(),
		p: real('p').notNull()
	},
	(t) => [uniqueIndex('feature_template_efforts_pk').on(t.templateId, t.roleId)]
);

// ── F2 Prospek ─────────────────────────────────────────────────


export const prospects = sqliteTable('prospects', {
	id: integer('id').primaryKey(),
	name: text('name').notNull(),
	client: text('client').notNull().default(''),
	contact: text('contact').notNull().default(''),
	needs: text('needs').notNull().default(''),
	businessGoal: text('business_goal').notNull().default(''),
	/** YYYY-MM-DD */
	deadline: text('deadline'),
	budget: integer('budget'),
	status: text('status', { enum: PROSPECT_STATUSES }).notNull().default('prospek'),
	notes: text('notes').notNull().default(''),
	cancelReason: text('cancel_reason'),
	createdAt: createdAt()
});

export const statusHistory = sqliteTable('status_history', {
	id: integer('id').primaryKey(),
	prospectId: integer('prospect_id').notNull().references(() => prospects.id, { onDelete: 'cascade' }),
	from: text('from', { enum: PROSPECT_STATUSES }),
	to: text('to', { enum: PROSPECT_STATUSES }).notNull(),
	note: text('note').notNull().default(''),
	createdAt: createdAt()
});

// ── F4–F7 Estimasi ─────────────────────────────────────────────

/** Salinan peran + rate saat estimasi dibuat, agar angka lama tidak berubah diam-diam. */
export type { RateSnapshot } from '../../estimate.ts';
import type { RateSnapshot } from '../../estimate.ts';

export const estimates = sqliteTable(
	'estimates',
	{
		id: integer('id').primaryKey(),
		prospectId: integer('prospect_id').notNull().references(() => prospects.id, { onDelete: 'cascade' }),
		version: integer('version').notNull(),
		isFinal: integer('is_final', { mode: 'boolean' }).notNull().default(false),
		finalizedAt: integer('finalized_at', { mode: 'timestamp' }),
		settings: text('snapshot_settings', { mode: 'json' }).$type<EstimateSettings>().notNull(),
		rates: text('snapshot_rates', { mode: 'json' }).$type<RateSnapshot[]>().notNull(),
		assumptions: text('assumptions').notNull().default(''),
		exclusions: text('exclusions').notNull().default(''),
		/** Risiko utama, satu per baris; masuk ke ringkasan direksi dan RAID log saat deal. */
		risks: text('risks').notNull().default(''),
		/** Rencana tanggal mulai (YYYY-MM-DD); bila diisi, libur mengurangi kapasitas sprint. */
		plannedStart: text('planned_start'),
		/** Salinan kalender libur saat estimasi dibuat/diperbarui, agar angka tidak berubah diam-diam. */
		holidays: text('snapshot_holidays', { mode: 'json' }).$type<Holiday[]>().notNull().default(sql`'[]'`),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('estimates_prospect_version').on(t.prospectId, t.version)]
);

export const estimateFeatures = sqliteTable('estimate_features', {
	id: integer('id').primaryKey(),
	estimateId: integer('estimate_id').notNull().references(() => estimates.id, { onDelete: 'cascade' }),
	module: text('module').notNull().default(''),
	name: text('name').notNull(),
	description: text('description').notNull().default(''),
	priority: text('priority', { enum: ['must', 'should', 'could'] }).$type<Priority>().notNull().default('must'),
	assumptions: text('assumptions').notNull().default(''),
	sortOrder: integer('sort_order').notNull().default(0),
	/** Hasil draf AI yang belum ditinjau PM; estimasi tidak bisa final selama masih ada. */
	aiDraft: integer('ai_draft', { mode: 'boolean' }).notNull().default(false)
});

/** O/M/P selalu dalam jam; satuan SP hanya tampilan (PRD 7.0). */
export const estimateEfforts = sqliteTable(
	'estimate_efforts',
	{
		featureId: integer('feature_id').notNull().references(() => estimateFeatures.id, { onDelete: 'cascade' }),
		roleId: integer('role_id').notNull().references(() => roles.id),
		o: real('o').notNull(),
		m: real('m').notNull(),
		p: real('p').notNull()
	},
	(t) => [uniqueIndex('estimate_efforts_pk').on(t.featureId, t.roleId)]
);

export const scenarios = sqliteTable('scenarios', {
	id: integer('id').primaryKey(),
	estimateId: integer('estimate_id').notNull().references(() => estimates.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	/** null = semua prioritas */
	priorities: text('priorities', { mode: 'json' }).$type<Priority[] | null>(),
	overhead: text('overhead_items', { mode: 'json' }).$type<OverheadItem[]>().notNull().default(sql`'[]'`),
	sortOrder: integer('sort_order').notNull().default(0)
});

export const scenarioTeam = sqliteTable(
	'scenario_team',
	{
		scenarioId: integer('scenario_id').notNull().references(() => scenarios.id, { onDelete: 'cascade' }),
		roleId: integer('role_id').notNull().references(() => roles.id),
		mp: real('mp').notNull(),
		/** null = sepanjang proyek */
		months: real('months')
	},
	(t) => [uniqueIndex('scenario_team_pk').on(t.scenarioId, t.roleId)]
);

// ── F9 Proyek ──────────────────────────────────────────────────

export const projects = sqliteTable('projects', {
	id: integer('id').primaryKey(),
	prospectId: integer('prospect_id').notNull().unique().references(() => prospects.id),
	baselineEstimateId: integer('baseline_estimate_id').notNull().references(() => estimates.id),
	baselineScenarioId: integer('baseline_scenario_id').notNull().references(() => scenarios.id),
	/** YYYY-MM-DD */
	startDate: text('start_date').notNull(),
	/** Angka baseline yang dibekukan saat Deal. */
	baseline: text('baseline', { mode: 'json' }).$type<ProjectBaseline>().notNull().default(sql`'{}'`),
	status: text('status', { enum: ['aktif', 'selesai', 'ditunda'] }).notNull().default('aktif'),
	/** Status kesehatan yang ditetapkan PM (F10); null = otomatis. */
	healthOverride: text('health_override', { enum: ['hijau', 'kuning', 'merah'] }),
	healthReason: text('health_reason'),
	createdAt: createdAt()
});

export const sprints = sqliteTable('sprints', {
	id: integer('id').primaryKey(),
	projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
	number: integer('number').notNull(),
	startDate: text('start_date').notNull(),
	endDate: text('end_date').notNull(),
	plan: text('plan').notNull().default(''),
	actual: text('actual').notNull().default('')
});

export const raidItems = sqliteTable('raid_items', {
	id: integer('id').primaryKey(),
	projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
	type: text('type', { enum: ['risk', 'assumption', 'issue', 'dependency'] }).notNull(),
	description: text('description').notNull(),
	owner: text('owner').notNull().default(''),
	impact: integer('impact'),
	likelihood: integer('likelihood'),
	mitigation: text('mitigation').notNull().default(''),
	reviewDate: text('review_date'),
	status: text('status', { enum: ['terbuka', 'dipantau', 'selesai'] }).notNull().default('terbuka'),
	createdAt: createdAt(),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
});

/** Change request (F13). Dampak dibekukan saat diputuskan; yang disetujui masuk jadwal sebagai baris tambahan. */
export const changeRequests = sqliteTable(
	'change_requests',
	{
		id: integer('id').primaryKey(),
		projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
		/** Nomor urut per proyek (CR-1, CR-2, ...). */
		number: integer('number').notNull(),
		title: text('title').notNull(),
		description: text('description').notNull().default(''),
		requester: text('requester').notNull().default(''),
		/** YYYY-MM-DD */
		requestDate: text('request_date').notNull(),
		reason: text('reason').notNull().default(''),
		/** Effort per peran dalam jam (O/M/P), seperti fitur estimasi. */
		efforts: text('efforts', { mode: 'json' }).$type<ThreePointMap>().notNull().default(sql`'{}'`),
		status: text('status', { enum: ['diajukan', 'disetujui', 'ditolak'] }).notNull().default('diajukan'),
		approver: text('approver').notNull().default(''),
		decisionDate: text('decision_date'),
		decisionNote: text('decision_note').notNull().default(''),
		impact: text('impact', { mode: 'json' }).$type<CrImpact>(),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('change_requests_number').on(t.projectId, t.number)]
);

/** Decision log (F12). Tidak dihapus; pembatalan = keputusan baru yang merujuk keputusan lama. */
export const decisions = sqliteTable(
	'decisions',
	{
		id: integer('id').primaryKey(),
		projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
		/** Nomor urut per proyek (K-1, K-2, ...). */
		number: integer('number').notNull(),
		/** YYYY-MM-DD */
		date: text('date').notNull(),
		decision: text('decision').notNull(),
		decidedBy: text('decided_by').notNull().default(''),
		reason: text('reason').notNull().default(''),
		alternatives: text('alternatives').notNull().default(''),
		impact: text('impact').notNull().default(''),
		/** Tautan dokumen atau notulen rapat. */
		link: text('link').notNull().default(''),
		/** Keputusan lama yang dibatalkan/digantikan oleh keputusan ini. */
		supersedesId: integer('supersedes_id').references((): AnySQLiteColumn => decisions.id),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('decisions_number').on(t.projectId, t.number), uniqueIndex('decisions_supersedes').on(t.supersedesId)]
);

/** Jadwal dan progres fitur di proyek berjalan (Gantt). Sprint 1-based, inklusif. */
export const projectFeatures = sqliteTable(
	'project_features',
	{
		projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
		/** Fitur di estimasi baseline (final, terkunci, sehingga ID-nya stabil); null untuk change request. */
		featureId: integer('feature_id').references(() => estimateFeatures.id),
		/** Change request yang disetujui; null untuk fitur baseline. */
		changeRequestId: integer('change_request_id').references(() => changeRequests.id, { onDelete: 'cascade' }),
		baselineStart: integer('baseline_start').notNull(),
		baselineEnd: integer('baseline_end').notNull(),
		planStart: integer('plan_start').notNull(),
		planEnd: integer('plan_end').notNull(),
		/** 0–100; status diturunkan: 0 belum, 100 selesai, selain itu berjalan. */
		progress: integer('progress').notNull().default(0),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
	},
	(t) => [
		uniqueIndex('project_features_pk').on(t.projectId, t.featureId),
		uniqueIndex('project_features_cr').on(t.changeRequestId)
	]
);

/** Aktivitas dan milestone proyek (kick-off, sprint, SIT, UAT, go-live, dll.) untuk Gantt. */
export const projectActivities = sqliteTable('project_activities', {
	id: integer('id').primaryKey(),
	projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	kind: text('kind', { enum: ['aktivitas', 'milestone'] }).notNull(),
	/** YYYY-MM-DD; milestone: tanggal mulai = selesai. */
	startDate: text('start_date').notNull(),
	endDate: text('end_date').notNull(),
	done: integer('done', { mode: 'boolean' }).notNull().default(false),
	sortOrder: integer('sort_order').notNull().default(0),
	/** Aktivitas "Sprint N" dari templat: dicentang otomatis saat semua fitur yang selesai di sprint N mencapai 100%. */
	sprintNumber: integer('sprint_number')
});

/** Laporan status mingguan (F14). Data otomatis dibekukan di `snapshot` saat dikirim. */
export const statusReports = sqliteTable(
	'status_reports',
	{
		id: integer('id').primaryKey(),
		projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
		/** Senin awal minggu (YYYY-MM-DD). */
		periodStart: text('period_start').notNull(),
		periodEnd: text('period_end').notNull(),
		achievements: text('achievements').notNull().default(''),
		obstacles: text('obstacles').notNull().default(''),
		nextWeek: text('next_week').notNull().default(''),
		helpNeeded: text('help_needed').notNull().default(''),
		/** null selama draf; diisi saat ditandai terkirim. */
		snapshot: text('snapshot', { mode: 'json' }).$type<ReportData>(),
		sentAt: integer('sent_at', { mode: 'timestamp' }),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('status_reports_week').on(t.projectId, t.periodStart)]
);
