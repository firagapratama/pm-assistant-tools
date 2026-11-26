// State editor estimasi: satu draf, satu hasil hitung, dipakai semua tab dan panel ringkasan.
import { fromHours, toHours, type Priority, type ThreePoint } from '#lib/calc/index.ts';
import { calendarFor, computeDraft, finalizeProblems, type RateSnapshot } from '#lib/estimate.ts';
import type { Holiday } from '#lib/calc/calendar.ts';
import { decimal } from '#lib/format/index.ts';
import { roleLabel } from '#lib/labels.ts';
import type { DraftFeature, EstimateDraft } from '#lib/validation/estimate.ts';
import { isOrdered } from '#lib/calc/pert.ts';

export type EditorFeature = DraftFeature & { key: number };

let nextKey = 1;
// $state.snapshot menyalin objek biasa maupun proxy reaktif Svelte (structuredClone gagal pada proxy).
const withKey = (f: DraftFeature): EditorFeature => ({ ...($state.snapshot(f) as DraftFeature), key: nextKey++ });

export class EstimateEditor {
	features: EditorFeature[] = $state([]);
	settings: EstimateDraft['settings'] = $state()!;
	assumptions = $state('');
	exclusions = $state('');
	risks = $state('');
	plannedStart: string | null = $state(null);
	holidays: Holiday[] = $state([]);
	team: EstimateDraft['team'] = $state([]);
	overhead: EstimateDraft['overhead'] = $state([]);
	rates: RateSnapshot[] = $state([]);
	locked = $state(false);
	/** Peran yang tampil sebagai kolom di tabel fitur. */
	columns: number[] = $state([]);

	constructor(draft: EstimateDraft, rates: RateSnapshot[], holidays: Holiday[], locked: boolean) {
		this.plannedStart = draft.plannedStart;
		this.holidays = holidays;
		this.features = draft.features.map(withKey);
		this.settings = structuredClone(draft.settings);
		this.assumptions = draft.assumptions;
		this.exclusions = draft.exclusions;
		this.risks = draft.risks;
		this.team = structuredClone(draft.team);
		this.overhead = structuredClone(draft.overhead);
		this.rates = rates;
		this.locked = locked;
		const used = new Set(draft.features.flatMap((f) => Object.keys(f.efforts).map(Number)));
		this.columns = used.size ? rates.map((r) => r.roleId).filter((id) => used.has(id)) : rates.map((r) => r.roleId);
	}

	/** Isi estimasi tanpa kunci internal editor, siap dikirim ke server. */
	get draft(): EstimateDraft {
		return {
			settings: this.settings,
			assumptions: this.assumptions,
			exclusions: this.exclusions,
			risks: this.risks,
			plannedStart: this.plannedStart,
			features: this.features.map(({ key: _key, ...f }) => f),
			team: this.team,
			overhead: this.overhead
		};
	}

	result = $derived(computeDraft(this.draft, this.rates, this.holidays));
	/** Kalender kerja bila rencana mulai diisi. */
	calendar = $derived(calendarFor(this.draft, this.holidays));
	problems = $derived(finalizeProblems(this.draft, this.rates, this.result));

	// ── Satuan ──
	get unit() {
		return this.settings.inputUnit;
	}
	get unitLabel() {
		return this.settings.inputUnit === 'sp' ? 'SP' : 'jam';
	}
	toUnit = (hours: number) => fromHours(hours, this.settings.inputUnit, this.settings.spPerHour);
	fromUnit = (value: number) => toHours(value, this.settings.inputUnit, this.settings.spPerHour);
	/** "96 SP ≈ 48 jam" atau "48 jam". */
	effortText = (hours: number, digits = 1) =>
		this.unit === 'sp'
			? `${decimal(this.toUnit(hours), digits)} SP ≈ ${decimal(hours, digits)} jam`
			: `${decimal(hours, digits)} jam`;

	// ── Peran ──
	role = (id: number) => this.rates.find((r) => r.roleId === id);
	roleName = (id: number) => {
		const r = this.role(id);
		return r ? roleLabel(r) : `Peran #${id}`;
	};
	addColumn(id: number) {
		if (!this.columns.includes(id)) this.columns.push(id);
	}
	removeColumn(id: number) {
		this.columns = this.columns.filter((c) => c !== id);
	}
	columnHasEffort = (id: number) => this.features.some((f) => f.efforts[id] && (f.efforts[id].o || f.efforts[id].m || f.efforts[id].p));

	// ── Fitur ──
	addFeature(module = ''): number {
		const f = withKey({ module, name: '', description: '', priority: 'must', assumptions: '', efforts: {} });
		this.features.push(f);
		return f.key;
	}
	/**
	 * Memasukkan fitur dari draf (AI) ke estimasi, lalu mengembalikan fungsi untuk mengurungkan.
	 * `notes` ditambahkan ke asumsi/tidak termasuk/risiko, tanpa mengulang baris yang sudah ada.
	 */
	applyDraft(
		features: DraftFeature[],
		mode: 'append' | 'replace',
		notes?: { assumptions: string[]; exclusions: string[]; risks: string[] }
	): () => void {
		const before = {
			features: $state.snapshot(this.features),
			assumptions: this.assumptions,
			exclusions: this.exclusions,
			risks: this.risks
		};
		const added = features.map(withKey);
		this.features = mode === 'replace' ? added : [...this.features, ...added];
		for (const f of added) for (const id of Object.keys(f.efforts)) this.addColumn(Number(id));
		if (notes) {
			const merge = (text: string, lines: string[]) => {
				const have = new Set(text.split('\n').map((l) => l.trim().toLowerCase()));
				const extra = lines.filter((l) => !have.has(l.trim().toLowerCase()));
				return [text.trim(), ...extra].filter(Boolean).join('\n');
			};
			this.assumptions = merge(this.assumptions, notes.assumptions);
			this.exclusions = merge(this.exclusions, notes.exclusions);
			this.risks = merge(this.risks, notes.risks);
		}
		return () => {
			this.features = before.features;
			this.assumptions = before.assumptions;
			this.exclusions = before.exclusions;
			this.risks = before.risks;
		};
	}

	duplicate(key: number): number {
		const i = this.features.findIndex((f) => f.key === key);
		const copy = withKey({ ...this.features[i], name: `${this.features[i].name} (salinan)` });
		this.features.splice(i + 1, 0, copy);
		return copy.key;
	}
	/** Menghapus fitur; mengembalikan fungsi untuk mengurungkan. */
	remove(key: number): () => void {
		const index = this.features.findIndex((f) => f.key === key);
		const [removed] = this.features.splice(index, 1);
		const snapshot = $state.snapshot(removed);
		return () => this.features.splice(Math.min(index, this.features.length), 0, snapshot);
	}
	move(key: number, dir: -1 | 1) {
		const i = this.features.findIndex((f) => f.key === key);
		const j = i + dir;
		if (j < 0 || j >= this.features.length) return;
		[this.features[i], this.features[j]] = [this.features[j], this.features[i]];
	}
	setPriority(key: number, priority: Priority) {
		const f = this.features.find((x) => x.key === key);
		if (f) f.priority = priority;
	}
	effort = (f: EditorFeature, roleId: number): ThreePoint => f.efforts[roleId] ?? { o: 0, m: 0, p: 0 };
	setEffort(f: EditorFeature, roleId: number, field: keyof ThreePoint, hours: number) {
		const t = { ...this.effort(f, roleId), [field]: hours };
		if (t.o === 0 && t.m === 0 && t.p === 0) delete f.efforts[roleId];
		else f.efforts[roleId] = t;
	}
	isValidEffort = (t: ThreePoint) => isOrdered(t);
	featureValid = (f: EditorFeature) => Object.values(f.efforts).every(isOrdered);
	invalidCount = $derived(this.features.filter((f) => !this.featureValid(f)).length);
	modules = $derived([...new Set(this.features.map((f) => f.module.trim()).filter(Boolean))]);

	// ── Tim ──
	member = (roleId: number) => this.team.find((t) => t.roleId === roleId);
	setMember(roleId: number, patch: Partial<{ mp: number; months: number | null }>) {
		const m = this.member(roleId);
		if (m) Object.assign(m, patch);
		else this.team.push({ roleId, mp: 0, months: null, ...patch });
	}
}
