// Libur nasional dan cuti bersama resmi menurut SKB 3 Menteri (Menag, Menaker, MenPANRB).
// Sumber: setneg.go.id
//   2026: https://www.setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2026
//   2027: https://setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2027
// Tahun berikutnya ditambahkan lewat Pengaturan → Kalender libur setelah SKB terbit (biasanya September).
import type { Holiday } from '../calc/calendar.ts';

const n = (date: string, name: string): Holiday => ({ date, name, type: 'nasional' });
const c = (date: string, name: string): Holiday => ({ date, name, type: 'cuti_bersama' });

export const OFFICIAL_HOLIDAYS: Record<number, Holiday[]> = {
	2026: [
		n('2026-01-01', 'Tahun Baru 2026 Masehi'),
		n('2026-01-16', 'Isra Mikraj Nabi Muhammad saw.'),
		c('2026-02-16', 'Tahun Baru Imlek 2577 Kongzili'),
		n('2026-02-17', 'Tahun Baru Imlek 2577 Kongzili'),
		c('2026-03-18', 'Hari Suci Nyepi (Tahun Baru Saka 1948)'),
		n('2026-03-19', 'Hari Suci Nyepi (Tahun Baru Saka 1948)'),
		c('2026-03-20', 'Idulfitri 1447 H'),
		n('2026-03-21', 'Idulfitri 1447 H'),
		n('2026-03-22', 'Idulfitri 1447 H'),
		c('2026-03-23', 'Idulfitri 1447 H'),
		c('2026-03-24', 'Idulfitri 1447 H'),
		n('2026-04-03', 'Wafat Yesus Kristus'),
		n('2026-04-05', 'Kebangkitan Yesus Kristus (Paskah)'),
		n('2026-05-01', 'Hari Buruh Internasional'),
		n('2026-05-14', 'Kenaikan Yesus Kristus'),
		c('2026-05-15', 'Kenaikan Yesus Kristus'),
		n('2026-05-27', 'Iduladha 1447 H'),
		c('2026-05-28', 'Iduladha 1447 H'),
		n('2026-05-31', 'Hari Raya Waisak 2570 BE'),
		n('2026-06-01', 'Hari Lahir Pancasila'),
		n('2026-06-16', '1 Muharam Tahun Baru Islam 1448 H'),
		n('2026-08-17', 'Proklamasi Kemerdekaan'),
		n('2026-08-25', 'Maulid Nabi Muhammad saw.'),
		c('2026-12-24', 'Kelahiran Yesus Kristus'),
		n('2026-12-25', 'Kelahiran Yesus Kristus')
	],
	2027: [
		n('2027-01-01', 'Tahun Baru 2027 Masehi'),
		n('2027-01-05', 'Isra Mikraj Nabi Muhammad saw.'),
		c('2027-02-05', 'Tahun Baru Imlek 2578 Kongzili'),
		n('2027-02-06', 'Tahun Baru Imlek 2578 Kongzili'),
		n('2027-03-08', 'Hari Suci Nyepi (Tahun Baru Saka 1949)'),
		c('2027-03-09', 'Idulfitri 1448 H'),
		n('2027-03-10', 'Idulfitri 1448 H'),
		n('2027-03-11', 'Idulfitri 1448 H'),
		c('2027-03-12', 'Idulfitri 1448 H'),
		c('2027-03-15', 'Idulfitri 1448 H'),
		c('2027-03-25', 'Wafat Yesus Kristus'),
		n('2027-03-26', 'Wafat Yesus Kristus'),
		n('2027-03-28', 'Kebangkitan Yesus Kristus (Paskah)'),
		n('2027-05-01', 'Hari Buruh Internasional'),
		n('2027-05-06', 'Kenaikan Yesus Kristus'),
		n('2027-05-17', 'Iduladha 1448 H'),
		c('2027-05-18', 'Iduladha 1448 H'),
		c('2027-05-19', 'Hari Raya Waisak 2571 BE'),
		n('2027-05-20', 'Hari Raya Waisak 2571 BE'),
		n('2027-06-01', 'Hari Lahir Pancasila'),
		n('2027-06-06', '1 Muharam Tahun Baru Islam 1449 H'),
		n('2027-08-15', 'Maulid Nabi Muhammad saw.'),
		n('2027-08-17', 'Proklamasi Kemerdekaan'),
		c('2027-12-24', 'Kelahiran Yesus Kristus (Natal)'),
		n('2027-12-25', 'Kelahiran Yesus Kristus (Natal)'),
		n('2027-12-26', 'Isra Mikraj Nabi Muhammad saw.')
	]
};
