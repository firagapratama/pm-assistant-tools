# Tech Stack — PM Workspace

**Rancangan teknis yang ringan untuk server kecil.** Pendamping `PRD-PM-Workspace.md` (v0.4) dan `design.md` (v0.3).

| Atribut | Keterangan |
|---|---|
| Versi | 0.2 |
| Tanggal | 26 November 2026 |
| Status | Stack diputuskan dan berjalan di lokal. Hosting belum diputuskan (Bagian 14). |

**Riwayat perubahan**

| Versi | Perubahan |
|---|---|
| 0.1 | Usulan awal. |
| 0.2 | Diselaraskan dengan PRD v0.4: stack dikonfirmasi (T2); effort disimpan dalam jam; ditambahkan integrasi AI (4.3), kalender libur (4.4), backup lokal sebelum deploy (10.1), dan aturan keamanan AI. |

---

## 1. Batasan dan Kriteria

| Kriteria | Target |
|---|---|
| Pengguna | 1 orang (single user) |
| Server | VPS kecil: 1 vCPU, RAM 1 GB (minimum yang masih nyaman: 512 MB) |
| Pemakaian RAM aplikasi | < 150 MB saat berjalan normal |
| Perhitungan ulang estimasi | Instan di browser (< 50 ms untuk ≤ 200 fitur), tanpa menunggu server |
| JavaScript halaman awal | < 100 KB (gzip) |
| Tampilan | Mengikuti `design.md` sepenuhnya, tanpa kompromi karena framework |
| Perawatan | Sedikit komponen bergerak: satu proses aplikasi, satu file database, satu web server |

Prinsip pemilihan: **sesedikit mungkin layanan yang harus dijalankan dan dirawat.** Tidak ada database server terpisah, tidak ada Redis, tidak ada antrean pekerjaan, tidak ada container orchestration.

## 2. Ringkasan Stack

| Lapisan | Pilihan | Peran |
|---|---|---|
| Framework | **SvelteKit** (Svelte 5) + TypeScript | Frontend dan backend dalam satu aplikasi |
| Runtime | **Node.js** (versi LTS aktif) dengan `@sveltejs/adapter-node` | Menjalankan aplikasi di server |
| Database | **SQLite** (mode WAL) via `better-sqlite3` | Penyimpanan data dalam satu file |
| ORM / query | **Drizzle ORM** + Drizzle Kit | Skema bertipe dan migrasi |
| Styling | **CSS biasa** dengan token dari `design.md` (scoped CSS bawaan Svelte) | Tampilan |
| Font | IBM Plex Sans, di-host sendiri (woff2, subset Latin) | Tipografi |
| Ikon | Lucide (paket Svelte) | Ikon |
| Grafik | Komponen **SVG buatan sendiri** | Pita rentang, burndown, grafik sederhana |
| Validasi | **Valibot** | Validasi input form dan API |
| Autentikasi | Sesi berbasis cookie buatan sendiri + hash password **Argon2id** | Login satu pengguna |
| Ekspor PDF | **CSS cetak** + "Simpan sebagai PDF" dari browser | Ringkasan direksi dan laporan |
| Ekspor tabel | CSV (bawaan), XLSX opsional via **SheetJS** dimuat saat dibutuhkan | Ekspor data estimasi |
| Web server | **Caddy** | Reverse proxy dan HTTPS otomatis |
| Proses | **systemd** | Menjalankan dan memulai ulang aplikasi |
| Backup | Lokal: skrip `better-sqlite3` backup ke folder tersinkron cloud. Server: **Litestream** atau backup harian | Cadangan data |
| Draf AI | API **kompatibel OpenAI**, dipanggil dengan `fetch` dari server (tanpa SDK) | Draf fitur estimasi |
| Kalender libur | Tabel `holidays` di SQLite, diisi dari SKB libur nasional dan cuti bersama | Kapasitas sprint dan jadwal |
| Pengujian | **Vitest** | Uji mesin kalkulasi |
| Package manager | **pnpm** | Instalasi dependensi |

## 3. Alasan Pemilihan

### 3.1 SvelteKit

Fitur terpenting di Fase 1 adalah editor estimasi dengan panel ringkasan yang **langsung diperbarui** setiap angka diubah. Ini membutuhkan reaktivitas yang baik di browser.

- **Svelte dikompilasi**, bukan membawa runtime besar ke browser. Ukuran JavaScript yang dikirim jauh lebih kecil dibanding React/Next.js untuk aplikasi seukuran ini.
- **Reaktivitas Svelte 5 (runes)** cocok untuk alur "ubah input → hitung ulang → perbarui ringkasan" tanpa library state tambahan.
- **Satu codebase** untuk halaman, API, dan akses database. Tidak perlu memisahkan proyek frontend dan backend.
- **Scoped CSS bawaan** memudahkan menerapkan `design.md` persis apa adanya, tanpa melawan kelas utilitas.
- Server-side rendering membuat halaman tampil cepat, lalu interaktivitas menyusul.

### 3.2 SQLite

- Tidak ada proses database terpisah, sehingga RAM dan perawatan berkurang drastis.
- Untuk satu pengguna, SQLite jauh lebih dari cukup. Kebanyakan query selesai dalam hitungan milidetik.
- Mode **WAL** dipakai agar baca dan tulis tidak saling menunggu.
- Backup cukup menyalin satu file (dengan cara yang aman, lihat Bagian 10).
- Data snapshot estimasi (rate dan parameter saat estimasi dibuat) disimpan sebagai kolom JSON, yang didukung baik oleh SQLite.

### 3.3 Drizzle ORM

- Ringan, tanpa engine terpisah. Hanya pembangun query bertipe di atas `better-sqlite3`.
- Skema ditulis di TypeScript, sehingga tipe data mengalir dari database sampai komponen.
- Drizzle Kit menghasilkan file migrasi SQL yang bisa dibaca dan diperiksa.

### 3.4 CSS Biasa, Bukan Framework CSS

`design.md` sudah mendefinisikan token lengkap (warna, jarak, tipografi). Token tersebut langsung menjadi variabel CSS. Menambah Tailwind atau library komponen hanya menambah lapisan yang harus "dibengkokkan" agar sesuai desain. Komponen dibuat sendiri dan jumlahnya sedikit: tombol, input angka, tabel, badge, pita rentang, toast, modal.

### 3.5 Grafik SVG Buatan Sendiri

Pita rentang adalah elemen khas desain dan bentuknya spesifik, sehingga paling tepat dibuat sendiri dengan SVG. Grafik lain di Fase 2 (burndown, rencana vs realisasi) juga sederhana dan cukup dibuat dengan SVG. Jika suatu saat butuh grafik yang lebih kompleks, gunakan **uPlot** (sangat kecil) yang dimuat hanya di halaman tersebut.

### 3.6 PDF dari CSS Cetak

Membuat PDF di server biasanya memerlukan headless Chrome (Puppeteer/Playwright), yang membutuhkan RAM ratusan MB per proses. Itu terlalu berat untuk server kecil.

Solusinya: halaman ringkasan direksi dirancang dengan `@media print` dan `@page { size: A4; margin: 18mm; }`. Pengguna menekan tombol "Ekspor PDF", aplikasi membuka tampilan cetak, lalu browser menyimpannya sebagai PDF. Hasilnya tajam (teks vektor), konsisten dengan desain, dan tidak membebani server sama sekali.

## 4. Arsitektur

```
 Browser
 ┌──────────────────────────────────────────────┐
 │ SvelteKit (halaman + komponen)               │
 │  └─ Mesin kalkulasi (TypeScript murni)       │  ← hitung ulang instan
 └───────────────────────┬──────────────────────┘
                         │ HTTPS
 VPS                     ▼
 ┌──────────────────────────────────────────────┐
 │ Caddy  (HTTPS otomatis, kompresi, cache aset) │
 │   │                                          │
 │   ▼ localhost:3000                           │
 │ Node.js — SvelteKit server (systemd)         │
 │  ├─ Load/actions: baca-tulis data            │
 │  ├─ Mesin kalkulasi (kode yang sama)         │  ← validasi ulang saat simpan
 │  └─ Drizzle ──► SQLite (data/app.db, WAL)    │
 │                     │                        │
 │                     ▼                        │
 │               Litestream ──► object storage  │
 └──────────────────────────────────────────────┘
```

### 4.1 Mesin Kalkulasi Bersama

Semua rumus di PRD Bagian 7 ditulis sebagai **modul TypeScript murni** (`src/lib/calc/`) tanpa ketergantungan pada framework, database, atau browser.

- Di browser: dipakai untuk menghitung ulang secara instan saat pengguna mengetik.
- Di server: dijalankan ulang saat estimasi disimpan atau ditandai final, sehingga angka yang tersimpan selalu hasil perhitungan resmi, bukan sekadar kiriman dari browser.
- Diuji dengan Vitest, termasuk contoh perhitungan di PRD Bagian 7.6 sebagai test case wajib.

### 4.2 Aturan Angka dan Uang

Kesalahan pembulatan pada angka biaya akan merusak kepercayaan direksi, jadi aturan ini wajib:

| Jenis | Disimpan sebagai | Contoh |
|---|---|---|
| Rupiah | Integer (rupiah penuh) | `279450000` |
| Persentase | Integer basis poin (1% = 100) | 15% → `1500` |
| Effort | **Jam** (desimal). SP hanya untuk input dan tampilan, dikonversi dengan `sp_per_jam` dari snapshot estimasi | 12,5 jam |
| Hasil antara | Number biasa, dibulatkan **hanya** di akhir dengan aturan tertulis | — |

Tidak ada perhitungan uang dengan floating point yang hasilnya langsung disimpan. Pembulatan Rupiah dilakukan ke rupiah terdekat di langkah terakhir.

### 4.3 Integrasi AI (Draf Fitur)

```
Browser ──► SvelteKit server ──(fetch, HTTPS)──► Penyedia AI (API kompatibel OpenAI)
            ├─ susun prompt dari data yang diizinkan
            ├─ samarkan identitas (opsional)
            ├─ validasi respons (Valibot)
            └─ catat ke tabel ai_calls (tanpa isi teks)
```

| Aspek | Ketentuan |
|---|---|
| Konfigurasi | `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` di variabel lingkungan. Jika `AI_API_KEY` kosong, fitur nonaktif otomatis. |
| Lokasi pemanggilan | Hanya dari server (`src/lib/server/ai/`). API key tidak pernah ada di kode browser. |
| Dependensi | `fetch` bawaan Node ke endpoint `/chat/completions`. Tanpa SDK, agar dependensi tetap kecil dan penyedia mudah diganti. |
| Data terkirim | Sesuai PRD F4: nama proyek, kebutuhan, tujuan, catatan, nama peran. Penyamaran dilakukan di server sebelum request dibuat. |
| Format respons | Model diminta mengembalikan JSON saja; hasil divalidasi dengan Valibot. Jika tidak valid, tampilkan pesan dan tidak ada yang disimpan. |
| Batas | Timeout 30 detik (`AbortController`), batas token keluaran, satu request berjalan pada satu waktu. |
| Log | Tabel `ai_calls`: waktu, penyedia, model, jumlah karakter, disamarkan atau tidak, berhasil atau gagal. |
| Model lokal | Karena API-nya kompatibel OpenAI, server model lokal di laptop dapat dipakai saat development untuk data yang sangat rahasia. VPS kecil tidak cukup untuk menjalankan model. |

### 4.4 Kalender Libur

- Tabel `holidays` (tanggal, nama, jenis: libur nasional / cuti bersama), diisi dari SKB resmi dan dapat diubah di Pengaturan.
- Diperbarui setiap kali SKB tahun berikutnya terbit; aplikasi menampilkan peringatan jika rencana proyek melewati tahun yang belum ada datanya.
- Estimasi menyimpan salinan libur (`snapshot_holidays`), sehingga perubahan kalender tidak menggeser estimasi lama.
- Mesin kalkulasi menerima daftar libur sebagai input, sehingga tetap murni dan mudah diuji.

## 5. Struktur Folder

```
pm-workspace/
├─ src/
│  ├─ lib/
│  │  ├─ calc/              # mesin kalkulasi murni + test
│  │  │  ├─ pert.ts
│  │  │  ├─ capacity.ts
│  │  │  ├─ cost.ts
│  │  │  ├─ units.ts         # konversi SP ↔ jam
│  │  │  └─ calc.test.ts
│  │  ├─ components/         # Button, NumberInput, Table, Badge, RangeBand, Toast...
│  │  ├─ format/             # format Rupiah, tanggal, desimal Indonesia
│  │  ├─ server/
│  │  │  ├─ db/
│  │  │  │  ├─ schema.ts     # skema Drizzle (PRD Bagian 8)
│  │  │  │  └─ index.ts
│  │  │  ├─ ai/              # klien AI, penyamaran, prompt, log
│  │  │  └─ auth.ts          # sesi dan hash password
│  │  └─ validation/         # skema Valibot
│  ├─ routes/
│  │  ├─ login/
│  │  ├─ prospek/
│  │  │  └─ [id]/estimasi/[versi]/
│  │  ├─ proyek/
│  │  ├─ library/
│  │  ├─ pengaturan/
│  │  └─ cetak/[estimasiId]/ # tampilan ringkasan direksi (A4)
│  ├─ styles/
│  │  ├─ tokens.css          # token dari design.md
│  │  ├─ base.css
│  │  └─ print.css
│  └─ hooks.server.ts         # cek sesi di setiap request
├─ static/fonts/              # IBM Plex Sans woff2
├─ drizzle/                   # file migrasi
├─ data/                      # app.db (tidak masuk git)
├─ scripts/
│  └─ backup.mjs            # backup lokal (Bagian 10.1)
└─ deploy/
   ├─ Caddyfile
   ├─ pm-workspace.service
   └─ litestream.yml
```

## 6. Autentikasi

Karena hanya satu pengguna, tidak perlu library autentikasi besar atau layanan pihak ketiga.

- Akun dibuat sekali melalui perintah CLI (`pnpm create-user`), bukan halaman registrasi publik.
- Password di-hash dengan **Argon2id**.
- Sesi disimpan di tabel `sessions` SQLite; cookie `HttpOnly`, `Secure`, `SameSite=Lax`, berlaku 30 hari dan diperpanjang saat aktif.
- Batasi percobaan login (misalnya 5 kali gagal → jeda 15 menit), dicatat di database.
- Semua rute selain `/login` diperiksa di `hooks.server.ts`.
- 2FA (TOTP) opsional di fase berikutnya.

## 7. Performa

| Teknik | Dampak |
|---|---|
| Kalkulasi di browser | Tidak ada perjalanan ke server saat mengetik angka |
| SQLite di proses yang sama | Query tanpa latensi jaringan |
| Font di-host sendiri dan di-subset | Tidak bergantung pada server font eksternal; ukuran file kecil |
| Caddy: kompresi zstd/gzip + cache panjang untuk aset ber-hash | Muatan halaman berikutnya hampir instan |
| SheetJS dan uPlot dimuat dinamis (`import()`) | Tidak membebani halaman yang tidak memakainya |
| Debounce simpan otomatis (± 800 ms) | Menulis ke database hanya setelah pengguna berhenti mengetik |

**Anggaran performa:**

| Metrik | Batas |
|---|---|
| JS awal (gzip) | < 100 KB |
| CSS total (gzip) | < 20 KB |
| Largest Contentful Paint | < 1,5 detik |
| Respons server (p95) | < 100 ms |
| RAM proses Node | < 150 MB |

## 8. Kebutuhan Server

| Komponen | Perkiraan RAM |
|---|---|
| Node.js + SvelteKit | ± 60–120 MB |
| Caddy | ± 20–40 MB |
| Litestream | ± 15–30 MB |
| Sistem operasi (Ubuntu/Debian minimal) | ± 150–250 MB |
| **Total** | **± 250–450 MB** |

Angka di atas adalah perkiraan kasar dan perlu diukur ulang setelah aplikasi berjalan. VPS 1 vCPU / 1 GB RAM sudah longgar. VPS 512 MB masih bisa dipakai dengan menambahkan swap 1 GB.

**Penyimpanan:** database estimasi untuk satu pengguna kemungkinan tetap di bawah 100 MB bahkan setelah bertahun-tahun.

## 9. Deployment

### 9.1 Langkah Awal (sekali)

1. Siapkan VPS (Debian/Ubuntu LTS), buat user non-root, aktifkan firewall (hanya port 22, 80, 443).
2. Pasang Node.js LTS, pnpm, Caddy, dan Litestream.
3. Arahkan domain atau subdomain ke IP server.
4. Salin `Caddyfile`, aktifkan service systemd.

### 9.2 Caddyfile (contoh)

```
pm.domainanda.com {
    encode zstd gzip
    reverse_proxy localhost:3000
    header {
        Strict-Transport-Security "max-age=31536000"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "same-origin"
    }
}
```

### 9.3 Service systemd (contoh)

```ini
[Unit]
Description=PM Workspace
After=network.target

[Service]
User=pm
WorkingDirectory=/opt/pm-workspace
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=ORIGIN=https://pm.domainanda.com
Environment=DATABASE_PATH=/opt/pm-workspace/data/app.db
ExecStart=/usr/bin/node build/index.js
Restart=on-failure
MemoryMax=300M

[Install]
WantedBy=multi-user.target
```

### 9.4 Rilis Versi Baru

Build dilakukan di komputer lokal (atau GitHub Actions), lalu hasil `build/` dikirim ke server dengan `rsync`, migrasi dijalankan, dan service di-restart. Server tidak perlu menjalankan proses build yang berat.

```
pnpm build
rsync -az build/ package.json pnpm-lock.yaml drizzle/ server:/opt/pm-workspace/
ssh server "cd /opt/pm-workspace && pnpm install --prod && pnpm db:migrate && sudo systemctl restart pm-workspace"
```

Docker tidak dipakai. Untuk satu aplikasi di satu server, systemd lebih sederhana dan lebih hemat RAM.

## 10. Backup

### 10.1 Sekarang: Backup Lokal (sebelum deploy)

Data sungguhan sudah ada di `data/app.db` di laptop. Skrip berikut memakai fitur backup online dari `better-sqlite3` (sudah menjadi dependensi), sehingga aman dijalankan saat aplikasi berjalan dan bekerja di Windows, macOS, maupun Linux.

```js
// scripts/backup.mjs
import Database from 'better-sqlite3';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const src = process.env.DATABASE_PATH ?? 'data/app.db';
const dest = process.env.BACKUP_DIR; // folder yang tersinkron ke cloud
const keep = 30;

if (!dest) throw new Error('BACKUP_DIR belum diisi');
mkdirSync(dest, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const file = `app-${stamp}.db`;

const db = new Database(src);
await db.backup(join(dest, file));
db.close();

const old = readdirSync(dest)
  .filter((f) => /^app-.*\.db$/.test(f))
  .sort()
  .reverse()
  .slice(keep);
for (const f of old) rmSync(join(dest, f));

console.log(`Backup tersimpan: ${file}`);
```

- Tambahkan `"db:backup": "node scripts/backup.mjs"` di `package.json`.
- Jadwalkan harian: cron (macOS/Linux) atau Task Scheduler (Windows). Juga jalankan manual sebelum migrasi database.
- `BACKUP_DIR` diarahkan ke folder yang tersinkron ke penyimpanan cloud, agar salinan tidak berada di disk yang sama.
- **Uji pemulihan sekali:** salin satu file backup, jalankan aplikasi dengan `DATABASE_PATH` mengarah ke file itu, pastikan data lengkap.

### 10.2 Setelah Deploy: Backup Server

| Opsi | Cara kerja | Kapan dipilih |
|---|---|---|
| **Litestream** (disarankan) | Mereplikasi perubahan SQLite secara terus-menerus ke object storage yang kompatibel S3 (Cloudflare R2, Backblaze B2, dll.) | Ingin kehilangan data maksimal beberapa detik |
| `sqlite3 .backup` + cron | Salinan harian yang aman, dikompresi, dikirim ke penyimpanan lain dengan `rclone`; simpan 30 salinan terakhir | Ingin paling sederhana |

Apa pun pilihannya:

- Jangan menyalin `app.db` dengan `cp` biasa saat aplikasi berjalan; gunakan `.backup` atau Litestream.
- Lakukan **uji pemulihan** minimal sekali setelah setup, dan ulangi setiap beberapa bulan.
- Fitur ekspor seluruh data ke JSON (PRD Bagian 9) menjadi lapisan pengaman tambahan.

## 11. Keamanan

- HTTPS wajib (otomatis oleh Caddy).
- Perlindungan CSRF bawaan SvelteKit untuk form actions tetap aktif.
- Semua input divalidasi dengan Valibot di server, meskipun sudah divalidasi di browser.
- Query hanya melalui Drizzle (parameterized), tanpa menyusun SQL dari string.
- File `.env` dan `data/` tidak masuk git.
- Pembaruan keamanan OS otomatis (`unattended-upgrades`).
- API key AI hanya di `.env` server, tidak pernah di repositori atau kode browser; gunakan key khusus aplikasi ini dengan batas pemakaian dari penyedia.
- Akses SSH hanya dengan key, login password dinonaktifkan.

## 12. Alat Pengembangan

| Alat | Kegunaan |
|---|---|
| TypeScript (mode strict) | Keamanan tipe dari database sampai UI |
| Vitest | Uji mesin kalkulasi dan fungsi format |
| ESLint + Prettier | Konsistensi kode |
| svelte-check | Pemeriksaan tipe komponen Svelte |
| Drizzle Studio | Melihat isi database saat development |

**Pengujian minimum sebelum rilis Fase 1:**

- Contoh PRD Bagian 7.6 menghasilkan angka yang persis sama (6 sprint, Rp279.450.000, Rp363.285.000).
- Validasi O ≤ M ≤ P.
- Konversi SP ↔ jam bolak-balik tanpa kehilangan nilai.
- Mengubah rate di master data tidak mengubah estimasi lama (snapshot).

Versi setiap dependensi dipilih dari rilis stabil terbaru saat proyek dimulai dan dikunci di `pnpm-lock.yaml`.

## 13. Alternatif yang Dipertimbangkan

| Alternatif | Kelebihan | Alasan tidak dipilih |
|---|---|---|
| Next.js (React) | Ekosistem sangat besar | Lebih berat di browser dan server; banyak fitur yang tidak dibutuhkan untuk satu pengguna |
| Laravel + Livewire | Matang, lengkap | Butuh PHP-FPM; interaksi hitung-ulang instan lebih alami di framework frontend reaktif |
| PocketBase + frontend statis | Satu binary Go, sangat ringan | Pilihan cadangan yang bagus; logika bisnis (snapshot, finalisasi) lebih nyaman ditulis di satu codebase TypeScript |
| PostgreSQL | Kuat untuk banyak pengguna | Butuh proses terpisah dan RAM lebih; tidak sebanding untuk satu pengguna |
| Tailwind / library komponen | Cepat untuk prototipe | Desain sudah punya token sendiri; menambah lapisan yang tidak perlu |
| PDF via Puppeteer | Ekspor PDF otomatis dari server | Terlalu berat untuk server kecil |

**Jika nanti butuh multi-user:** stack ini tetap bisa dipakai. SQLite sanggup menangani tim kecil; perpindahan ke PostgreSQL relatif mudah karena Drizzle mendukung keduanya.

## 14. Pertanyaan Terbuka

| ID | Pertanyaan | Dampak |
|---|---|---|
| T1 | Spesifikasi VPS yang dimiliki (vCPU, RAM, OS)? | Konfirmasi Bagian 8, kebutuhan swap |
| ~~T2~~ | ~~Svelte/TypeScript atau stack lain?~~ **Diputuskan (v0.2):** SvelteKit + TypeScript, sudah berjalan. | — |
| T3 | Apakah ada domain/subdomain untuk aplikasi ini? | HTTPS otomatis Caddy membutuhkan domain |
| T4 | Untuk backup server, ingin Litestream ke object storage atau backup harian sederhana? (Backup lokal sudah ditentukan di 10.1.) | Bagian 10.2 |
| T5 | Penyedia AI mana yang dipakai, dan sudahkah kebijakan retensi serta pemakaian data untuk pelatihan diperiksa? | Bagian 4.3, PRD F4 |
