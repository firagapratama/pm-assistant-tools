import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './calc/settings.ts';
import { diffVersions, type VersionInput } from './estimate-diff.ts';
import { computeAlternative } from './estimate.ts';

const rates = [{ roleId: 1, name: 'Backend', level: null, source: 'internal', monthlyRate: 15_000_000 }];
const f = (name: string, m: number, priority: 'must' | 'should' | 'could' = 'must') => ({ module: 'Kasir', name, description: '', priority, assumptions: '', efforts: { 1: { o: m, m, p: m } } });
const v = (version: number, over: Partial<VersionInput['draft']> = {}): VersionInput => ({
	version,
	rates,
	holidays: [],
	draft: { settings: DEFAULT_SETTINGS, assumptions: 'API tersedia', exclusions: '', risks: '', plannedStart: null, features: [f('Login', 10), f('Transaksi', 40)], team: [{ roleId: 1, mp: 1, months: null }], overhead: [], ...over }
});

describe('perbandingan versi', () => {
	it('fitur ditambah/dihapus/berubah, tim, parameter, asumsi, dan selisih angka', () => {
		const a = v(1);
		const b = v(2, {
			features: [f(' login ', 10), f('Transaksi', 60, 'should'), f('Laporan', 20)],
			team: [{ roleId: 1, mp: 2, months: null }],
			settings: { ...DEFAULT_SETTINGS, contingencyBp: 2000 },
			assumptions: 'API tersedia\nDesain dari klien'
		});
		const d = diffVersions(a, b);
		expect(d.added.map((x) => x.name)).toEqual(['Laporan']);
		expect(d.removed).toEqual([]);
		expect(d.changed).toEqual([expect.objectContaining({ name: 'Transaksi', hoursA: 40, hoursB: 60, priorityA: 'must', priorityB: 'should' })]);
		expect(d.team).toEqual([{ role: 'Backend', mpA: 1, mpB: 2 }]);
		expect(d.settings).toEqual([{ label: 'Contingency', from: '15%', to: '20%' }]);
		expect(d.notes.find((n) => n.kind === 'assumptions')).toMatchObject({ added: ['Desain dari klien'], removed: [] });
		expect(d.b.effortHours - d.a.effortHours).toBe(40);
		expect(d.b.price).toBeGreaterThan(d.a.price);
		expect(diffVersions(b, a).removed.map((x) => x.name)).toEqual(['Laporan']);
	});

	it('skenario alternatif: hanya Must-have dan tim berbeda', () => {
		const base = v(1, { features: [f('Login', 10), f('Transaksi', 40), f('Laporan', 200, 'could')] }).draft;
		const all = computeAlternative(base, { name: 'Semua', priorities: null, team: base.team }, rates);
		const must = computeAlternative(base, { name: 'Must', priorities: ['must'], team: base.team }, rates);
		const big = computeAlternative(base, { name: '2 BE', priorities: null, team: [{ roleId: 1, mp: 2, months: null }] }, rates);
		expect(must.totalEffort.e).toBe(50);
		expect(must.likely.sprint.totalSprints).toBeLessThan(all.likely.sprint.totalSprints);
		expect(big.likely.sprint.totalSprints).toBeLessThan(all.likely.sprint.totalSprints);
	});
});

describe('format parameter', () => {
	it('persen dengan koma desimal', () => {
		const a = v(1, { settings: { ...DEFAULT_SETTINGS, contingencyBp: 1250 } });
		expect(diffVersions(a, v(2)).settings).toEqual([{ label: 'Contingency', from: '12,5%', to: '15%' }]);
	});
});
