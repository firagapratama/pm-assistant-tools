// PRD 7.0. Effort disimpan dalam jam; story point hanya satuan tampilan/input.

export const spToHours = (sp: number, spPerHour: number) => sp / spPerHour;
export const hoursToSp = (hours: number, spPerHour: number) => hours * spPerHour;

export const toHours = (value: number, unit: 'sp' | 'jam', spPerHour: number) =>
	unit === 'sp' ? spToHours(value, spPerHour) : value;

export const fromHours = (hours: number, unit: 'sp' | 'jam', spPerHour: number) =>
	unit === 'sp' ? hoursToSp(hours, spPerHour) : hours;
