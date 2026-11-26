# Design — PM Workspace

**Panduan visual dan interaksi.** Pendamping `PRD-PM-Workspace.md` (v0.4) dan `tech-stack.md` (v0.2).

| Atribut | Keterangan |
|---|---|
| Versi | 0.3 |
| Tanggal | 26 November 2026 |
| Cakupan | Fase 1 (F1–F9) secara detail; Fase 2–3 mengikuti prinsip yang sama |

**Riwayat perubahan**

| Versi | Perubahan |
|---|---|
| 0.1 | Draft awal. |
| 0.2 | D1–D3 diputuskan: tanpa logo dan identitas perusahaan (proyek pribadi, cukup wordmark teks); hanya mode terang, tanpa mode gelap dan tanpa pengganti tema. Bagian mode gelap dihapus dan bagian 2 dinomori ulang; bagian kontras (2.3), 5.1, 5.4, 11, dan 13 disesuaikan. |
| 0.3 | Diselaraskan dengan sistem yang berjalan (PRD v0.4): tata letak dashboard dan halaman proyek (5.5, 5.6); komponen Gantt, matriks risiko, jadwal per fitur, status manual, draf AI, keadaan terkunci, dan laporan mingguan cetak (6.7–6.13). |

---

## 1. Arah Desain

### 1.1 Konsep: "Meja Gambar Perencana"

PM Workspace adalah alat untuk **merencanakan dengan ketidakpastian**. Karakternya diambil dari meja gambar seorang perencana: kertas yang tenang, tinta yang tegas untuk hal yang pasti, dan arsiran untuk hal yang masih berupa perkiraan.

Warna utamanya **nila** (indigo), warna tinta dan pewarna alam yang dalam dan serius tanpa terasa dingin. Nila dipakai sebagai satu-satunya warna identitas. Semua warna lain bersifat fungsional.

### 1.2 Prinsip

| Prinsip | Artinya dalam praktik |
|---|---|
| **Angka adalah tokoh utama** | Tipografi, perataan, dan ruang dirancang agar angka mudah dibaca dan dibandingkan. Dekorasi tidak boleh bersaing dengan angka. |
| **Ketidakpastian terlihat** | Setiap estimasi ditampilkan sebagai rentang, bukan titik. Ini satu-satunya elemen visual yang "berani" (lihat 1.3). |
| **Tenang secara default, tegas saat perlu** | Layar umumnya hanya berisi tinta di atas kertas. Warna status muncul hanya ketika ada sesuatu yang perlu diperhatikan. |
| **Struktur dari ruang, bukan kotak** | Pengelompokan memakai jarak dan satu garis tipis, bukan kartu bertumpuk dengan bayangan. |
| **Siap dibawa ke direksi** | Apa yang terlihat di layar harus tetap rapi saat dicetak atau diekspor ke PDF A4. |

### 1.3 Elemen Khas: Pita Rentang

Satu elemen yang membuat produk ini dikenali adalah **pita rentang**: visualisasi estimasi PERT yang muncul di mana pun ada angka estimasi.

```
Durasi proyek
                 5,2           6            6,9 sprint
   ┊   ░░░░░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓█▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░   ┊
   O (4)                       E                    P (8)

   ░ rentang penuh O–P      ▓ rentang ±1σ      █ nilai paling mungkin (E)
```

Aturan pita rentang:

- Rentang penuh O–P memakai `--nila-tipis`, rentang ±1σ memakai `--nila-sedang`, dan penanda E berupa garis vertikal 2px `--nila`.
- Angka E selalu ditulis paling tebal. Batas bawah dan atas ditulis lebih kecil dengan `--tinta-2`.
- Tiga ukuran: **besar** (ringkasan proyek dan halaman direksi), **sedang** (tabel per peran), **mini** (baris fitur, tinggi 6px tanpa label).
- Pita rentang tidak pernah diberi warna status. Ketidakpastian bukan masalah, melainkan informasi.

Selain pita rentang, semua elemen lain sengaja dibuat tenang.

---

## 2. Warna

### 2.1 Palet Inti

Aplikasi hanya memiliki **satu tema terang**. Tidak ada mode gelap dan tidak ada tombol pengganti tema, agar tampilan di layar selalu sama dengan hasil ekspor PDF untuk direksi.

| Token | Hex | Nama | Kegunaan |
|---|---|---|---|
| `--kertas` | `#F4F5F1` | Kertas | Latar halaman. Putih keabuan yang sedikit dingin, lebih nyaman dipandang lama daripada putih murni. |
| `--permukaan` | `#FFFFFF` | Permukaan | Area kerja: tabel, form, panel ringkasan. |
| `--tinta` | `#1C2230` | Tinta | Teks utama dan angka. |
| `--tinta-2` | `#596273` | Tinta lembut | Teks sekunder, label, keterangan. |
| `--garis` | `#DCDFD8` | Garis | Pembatas, border input, garis tabel. |
| `--nila` | `#2D3A6E` | Nila | Aksi utama, tautan, item aktif, penanda E. |
| `--nila-sedang` | `#AEB6D9` | Nila sedang | Rentang ±1σ pada pita rentang. |
| `--nila-tipis` | `#E3E6F2` | Nila tipis | Rentang O–P, baris terpilih, latar fokus. |

### 2.2 Warna Status

Dipakai **hanya** untuk status proyek, risiko, validasi, dan notifikasi. Tidak boleh dipakai untuk dekorasi atau grafik biasa.

| Status | Teks / ikon | Latar tipis | Kegunaan |
|---|---|---|---|
| Aman | `#276B44` | `#E8F3EC` | Proyek hijau, validasi berhasil |
| Waspada | `#8A5A12` (teks), `#B7791F` (ikon/titik) | `#FBF1DF` | Proyek kuning, peringatan |
| Kritis | `#B42318` | `#FBE9E7` | Proyek merah, error, risiko tinggi |

Status tidak pernah disampaikan dengan warna saja. Selalu ada ikon dan teks, misalnya titik ● + "Waspada".

### 2.3 Kontras (WCAG)

| Pasangan | Rasio | Status |
|---|---|---|
| Tinta di atas kertas | 14,5 : 1 | AAA |
| Tinta lembut di atas kertas | 5,6 : 1 | AA |
| Nila di atas putih | 10,8 : 1 | AAA |
| Teks putih di atas tombol nila | 10,8 : 1 | AAA |
| Aman di atas latar tipisnya | 5,6 : 1 | AA |
| Waspada (teks) di atas latar tipisnya | 5,3 : 1 | AA |
| Kritis di atas latar tipisnya | 5,6 : 1 | AA |

`#B7791F` (Waspada terang) hanya untuk ikon dan titik, bukan teks, karena kontrasnya 3,6 : 1.

### 2.4 Warna untuk Grafik

| Urutan seri | Warna | Catatan |
|---|---|---|
| 1 (utama / rencana) | `--nila` | |
| 2 (pembanding / realisasi) | `#7A8396` | Abu kebiruan |
| 3 | `#AEB6D9` | Nila sedang |
| 4 | `#C9CDC4` | Abu kertas |

Grafik maksimal 4 seri. Jika butuh lebih, pecah menjadi beberapa grafik kecil. Garis baseline atau target memakai garis putus-putus `--tinta-2`.

---

## 3. Tipografi

### 3.1 Typeface

| Peran | Typeface | Alasan |
|---|---|---|
| Semua teks | **IBM Plex Sans** (Google Fonts) | Lahir dari dunia teknik, karakternya presisi tetapi tetap hangat. Angka tabularnya sangat baik untuk tabel estimasi dan biaya. Mendukung bahasa Indonesia sepenuhnya. |

Fallback: `"IBM Plex Sans", "Segoe UI", system-ui, -apple-system, sans-serif`

Satu keluarga huruf saja. Hierarki dibangun dari ukuran dan ketebalan, bukan dari kombinasi font.

**Wajib:** semua angka di tabel, input, dan ringkasan memakai `font-variant-numeric: tabular-nums;` agar kolom angka sejajar.

### 3.2 Skala Huruf (rasio 1,25)

| Token | Ukuran | Tinggi baris | Ketebalan | Kegunaan |
|---|---|---|---|---|
| `--teks-angka-besar` | 39px | 1,1 | 600 | Angka utama ringkasan (durasi, harga) |
| `--teks-h1` | 31px | 1,2 | 600 | Judul halaman |
| `--teks-h2` | 25px | 1,25 | 600 | Judul bagian |
| `--teks-h3` | 20px | 1,3 | 600 | Sub-bagian, judul panel |
| `--teks-isi` | 15px | 1,55 | 400 | Teks utama, sel tabel |
| `--teks-kecil` | 13px | 1,45 | 400 | Label, keterangan, catatan kaki |
| `--teks-mini` | 12px | 1,4 | 500 | Label pita rentang, badge |

### 3.3 Aturan Tipografi

- Huruf kapital di awal kalimat saja (sentence case) untuk judul, tombol, dan label. Tidak memakai label ALL CAPS.
- Panjang baris teks paragraf maksimal ± 70 karakter.
- Angka di tabel **rata kanan**. Teks rata kiri. Tidak ada teks rata tengah kecuali label di bawah pita rentang.
- Satuan ditulis lebih kecil dan berwarna `--tinta-2` di samping angka: **6** sprint, **480** jam.
- Tidak menyorot satu kata dalam judul dengan warna atau gaya berbeda.

---

## 4. Ruang, Grid, dan Bentuk

### 4.1 Skala Jarak (basis 4px)

| Token | Nilai | Kegunaan umum |
|---|---|---|
| `--jarak-1` | 4px | Ikon ke teks |
| `--jarak-2` | 8px | Antar-elemen dalam satu kontrol |
| `--jarak-3` | 12px | Padding sel tabel (vertikal) |
| `--jarak-4` | 16px | Padding input, antar-field |
| `--jarak-6` | 24px | Antar-kelompok dalam satu bagian |
| `--jarak-8` | 32px | Antar-bagian |
| `--jarak-12` | 48px | Antar-blok besar di halaman |

### 4.2 Grid dan Lebar

- Lebar konten maksimal **1280px** untuk halaman kerja, **760px** untuk halaman bacaan (dokumen, laporan).
- Sidebar navigasi **224px** (dapat diciutkan menjadi 64px ikon saja).
- Grid 12 kolom dengan gutter 24px di desktop; satu kolom di bawah 768px.

### 4.3 Sudut dan Bayangan

| Elemen | Radius |
|---|---|
| Input, tombol, badge | 6px |
| Panel, popover, modal | 10px |
| Pita rentang | 3px (ujung sedikit membulat) |

Bayangan hanya untuk elemen yang **mengambang** di atas halaman (popover, dropdown, modal, toast):
`box-shadow: 0 8px 24px rgba(28, 34, 48, 0.12);`
Panel dan tabel tidak memakai bayangan, cukup border 1px `--garis` atau jarak.

---

## 5. Tata Letak Halaman

### 5.1 Kerangka Aplikasi

```
┌──────────┬────────────────────────────────────────────────────┐
│ PM       │  Judul halaman                    [Aksi utama]    │
│ Workspace│  Keterangan singkat                               │
│          │ ────────────────────────────────────────────────── │
│ Prospek  │                                                    │
│ Proyek   │  Konten                                            │
│ Library  │                                                    │
│ ──────── │                                                    │
│ Pengaturan                                                    │
└──────────┴────────────────────────────────────────────────────┘
```

- Bagian atas sidebar berisi wordmark teks "PM Workspace" (IBM Plex Sans 600, 16px, `--tinta`). Tanpa logo atau simbol.
- Sidebar berlatar `--kertas`, item aktif ditandai garis kiri 2px `--nila` dan teks nila. Tanpa latar blok berwarna.
- Judul halaman rata kiri. Aksi utama selalu di kanan atas, maksimal satu tombol primer per halaman.

### 5.2 Editor Estimasi (halaman terpenting)

```
┌─────────────────────────────────────────────┬───────────────────────┐
│ Aplikasi Kasir Toko Maju · v2 · Draft       │ Ringkasan             │
│ [Fitur] [Tim] [Biaya] [Skenario]            │                       │
│─────────────────────────────────────────────│ Durasi                │
│ Modul       Fitur          BE   FE   QA  ▬  │ 6 sprint · ± 3 bulan  │
│ ─────────────────────────────────────────── │ ░░▓▓▓█▓▓▓░░           │
│ Auth        Login          12   8    4  ▬▬  │                       │
│             Reset password  6   4    2  ▬   │ Harga jual            │
│ Transaksi   Kasir          40  32   16 ▬▬▬  │ Rp363,3 jt            │
│ ...                                         │ ░░▓▓▓█▓▓▓░░           │
│                                             │                       │
│ [+ Tambah fitur]  [Ambil dari library]      │ Bottleneck: Backend   │
│─────────────────────────────────────────────│                       │
│ Total (SP)         960  720  400            │ [Tandai final]        │
└─────────────────────────────────────────────┴───────────────────────┘
          area kerja (± 70%)                    panel ringkasan, sticky
```

- **Panel ringkasan selalu terlihat** (sticky) dan diperbarui seketika setiap angka diubah. Ini menjawab pertanyaan "kalau saya ubah ini, dampaknya apa?" tanpa berpindah halaman.
- Baris fitur menampilkan nilai E. Klik baris untuk membuka input O / M / P di bawahnya (inline expand), bukan modal.
- Kolom terakhir berisi pita rentang mini untuk melihat fitur mana yang paling tidak pasti.
- Di bawah 1024px, panel ringkasan berpindah menjadi bar ringkas di bawah layar yang bisa diketuk untuk dibuka.

### 5.3 Pipeline Prospek

```
Prospek (3)      Estimasi (2)     Proposal (1)     Negosiasi (1)    Deal
───────────      ───────────      ───────────      ───────────      ────
Aplikasi Kasir   Portal Vendor    Sistem HR        CRM Internal
Toko Maju        PT Sinar         Rp410–520 jt     Rp280–330 jt
Tenggat Mar 27   5–7 sprint       Dikirim 3 hari   v3 · menunggu
                                  lalu             direksi
```

Kolom kanban tanpa latar kartu tebal: setiap item dipisahkan garis tipis, dengan latar `--permukaan` hanya saat di-hover atau diseret.

### 5.4 Ringkasan Direksi (A4, cetak/PDF)

```
┌───────────────────────────────────────────┐
│ Estimasi Proyek                           │
│ Aplikasi Kasir Toko Maju                  │
│ Versi 2 · 26 November 2026                │
│───────────────────────────────────────────│
│ Durasi              Harga                 │
│ 6 sprint            Rp363,3 jt            │
│ ± 3 bulan           rentang Rp320–410 jt  │
│ ░░▓▓▓█▓▓▓░░         ░░▓▓▓█▓▓▓░░           │
│───────────────────────────────────────────│
│ Ruang lingkup       Tim                   │
│ · Autentikasi       Backend   2           │
│ · Transaksi kasir   Frontend  2           │
│ · Laporan harian    QA        1           │
│                     UI/UX     1           │
│───────────────────────────────────────────│
│ Asumsi · Tidak termasuk · Risiko utama    │
└───────────────────────────────────────────┘
```

- Latar putih, tanpa sidebar, tanpa tombol, tanpa logo atau identitas perusahaan. Kop cukup judul "Estimasi Proyek", nama proyek, versi, dan tanggal.
- Harus tetap terbaca jika dicetak hitam-putih: pita rentang memakai pola arsiran berbeda, bukan hanya beda warna.
- Margin cetak 18mm, satu halaman. Jika konten lebih panjang, detail dipindah ke lampiran halaman 2.

---

### 5.5 Dashboard Proyek

```
Proyek
2 Merah · 1 Kuning · 4 Hijau      3 risiko tinggi · 2 blocker · 1 CR menunggu
──────────────────────────────────────────────────────────────────────────────
● Merah   CRM Internal                          Sprint 5/8   Proyeksi 14 Feb
          Proyeksi mundur 24% dari rencana       ▓▓▓▓▓▓░░░░│░░  52% (rencana 61%)
──────────────────────────────────────────────────────────────────────────────
● Kuning  Portal Vendor PT Sinar                Sprint 3/6   Proyeksi 20 Jan
          Ditetapkan PM: vendor API belum siap   ▓▓▓▓░░│░░░░░  38% (rencana 45%)
──────────────────────────────────────────────────────────────────────────────
● Hijau   Aplikasi Kasir Toko Maju              Sprint 2/6   Sesuai rencana
          —                                      ▓▓▓│░░░░░░░░  30% (rencana 28%)
```

- Ringkasan angka di baris paling atas, berupa teks biasa, bukan kartu metrik.
- Satu baris per proyek, diurutkan dari yang paling bermasalah. Alasan status selalu tampil di baris kedua.
- Bilah progres: isi `--nila`, latar `--nila-tipis`, garis vertikal `│` 1,5px `--tinta` sebagai posisi rencana hari ini. Jarak antara isi dan garis langsung menunjukkan tertinggal atau di depan.
- Klik baris membuka halaman proyek.

### 5.6 Halaman Proyek

```
Aplikasi Kasir Toko Maju                     ● Hijau      [Buat laporan minggu ini]
Mulai 5 Jan 2026 · Target selesai 30 Mar 2026 · dari Estimasi v2 ◆
[Ringkasan] [Jadwal] [RAID] [Keputusan] [Change request] [Laporan]
```

- Tab berupa teks dengan garis bawah 2px `--nila` pada tab aktif, tanpa latar blok.
- Baris kedua kop selalu menautkan kembali ke estimasi asal (baseline).
- Satu tombol primer sesuai konteks tab (misalnya "Tambah risiko" di tab RAID).

## 6. Komponen

### 6.1 Tombol

| Varian | Tampilan | Kegunaan |
|---|---|---|
| Primer | Latar `--nila`, teks putih | Satu aksi utama per halaman: "Simpan estimasi", "Tandai final" |
| Sekunder | Border 1px `--garis`, teks `--tinta` | Aksi pendamping: "Ambil dari library" |
| Teks | Tanpa border, teks `--nila` | Aksi ringan: "Batal", "Lihat riwayat" |
| Bahaya | Border dan teks `--kritis` | "Hapus fitur", "Batalkan prospek" |

Tinggi 36px (desktop), 44px (sentuh). Label tombol berupa kata kerja yang jelas. Tidak menambahkan tanda panah di akhir label.

### 6.2 Input Angka

- Rata kanan, tabular-nums, satuan di dalam input sebelah kanan berwarna `--tinta-2` (`12 SP`).
- Fokus: border `--nila` 1,5px dan latar `--nila-tipis` tipis. Selalu terlihat saat navigasi keyboard.
- Input O / M / P disusun berdampingan dalam satu baris. Jika O ≤ M ≤ P tidak terpenuhi, ketiganya diberi border kritis dengan pesan di bawahnya: "Nilai optimis tidak boleh lebih besar dari paling mungkin."
- Tab dan Enter berpindah ke input berikutnya, agar pengisian puluhan fitur bisa dilakukan tanpa mouse.

### 6.3 Tabel

- Tanpa zebra stripe. Pemisah baris berupa garis 1px `--garis`.
- Header tabel: `--teks-kecil`, ketebalan 500, `--tinta-2`, menempel (sticky) saat digulir.
- Baris total: border atas 1,5px `--tinta`, angka tebal.
- Hover baris: latar `--nila-tipis` 50%.
- Kolom bottleneck atau nilai yang perlu diperhatikan diberi penanda kecil, bukan blok warna penuh.

### 6.4 Badge Status

```
● Aman      ● Waspada      ● Kritis      ○ Draft      ◆ Final
```

Titik 8px + teks `--teks-mini`. Latar tipis sesuai status, radius 6px. Draft dan Final memakai warna netral dan nila, bukan warna status.

### 6.5 Angka Utama (Ringkasan)

```
Harga jual
Rp363,3 jt
rentang Rp320–410 jt
```

Label `--teks-kecil` `--tinta-2` di atas, angka `--teks-angka-besar`, keterangan rentang di bawah. Tidak ada ikon dekoratif atau latar gradasi.

### 6.6 Toast dan Notifikasi

- Muncul di kanan bawah, hilang otomatis setelah 4 detik kecuali berisi error.
- Kata kerja konsisten dengan tombolnya: tombol "Simpan estimasi" → toast "Estimasi tersimpan".
- Untuk aksi yang bisa dibatalkan, toast memuat tombol "Urungkan".

---

### 6.7 Gantt Aktivitas dan Fitur

> **Keputusan PM (26 Nov 2026):** Gantt di halaman proyek hanya menampilkan **aktivitas dan milestone** (Kick-off, Sprint N, SIT, UAT, Go-live, dan aktivitas tambahan) agar halaman tidak penuh. Fitur dan baris CR dijadwalkan lewat tabel 6.8. Gambar di bawah tetap menjadi acuan gaya (bar, milestone, garis hari ini, arsiran libur).

```
                    Sprint 1     Sprint 2  ▒▒ Sprint 3     Sprint 4
                    5–16 Jan     19–30 Jan ▒▒ 2–13 Feb     16–27 Feb
                                         ┊ Hari ini
◆ Kick-off          ◆                    ┊
Login               ████████▓▓           ┊
Kasir               ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┊╌╌╌╌╌┐
                    ████████████▓▓▓▓▓▓▓▓▓┊▓▓▓▓▓▓▓▓▓▓▓▓      +1 sprint
CR-2 Diskon member                       ┊     ▓▓▓▓▓▓▓▓
◆ UAT                                    ┊                  ◆
```

| Elemen | Gaya |
|---|---|
| Bar rencana | Latar `--nila-sedang`, tinggi 10px, radius 3px |
| Progres | Bagian bar yang selesai diisi `--nila` |
| Baseline | Garis luar putus-putus 1px `--tinta-2`, hanya tampil jika rencana bergeser dari baseline |
| Bergeser / terlambat | Label kecil "+1 sprint" berwarna `--waspada` di ujung bar; bar tetap nila |
| Milestone | Belah ketupat ◆ 10px `--nila`; terisi bila selesai, garis luar bila belum |
| Baris CR | Label `CR-n` di depan nama, dengan `--teks-mini` dan `--tinta-2` |
| Hari ini | Garis vertikal putus-putus 1px `--tinta` dengan label "Hari ini" di atas |
| Libur | Kolom hari libur diarsir tipis `--garis`; tooltip menampilkan nama libur |
| Batas sprint | Garis vertikal 1px `--garis`; label sprint dan rentang tanggal di header |

- Kolom nama menempel (sticky) di kiri; area waktu bergulir horizontal di dalam wadahnya sendiri.
- Tidak ada animasi bar. Saat jadwal digeser, bar langsung berpindah.
- Untuk dicetak, bar diberi pola: rencana polos, progres solid, baseline garis putus-putus, sehingga tetap terbaca hitam-putih.

### 6.8 Tabel Jadwal dan Progres per Fitur

| Kolom | Isi |
|---|---|
| Fitur | Nama; baris CR diberi label `CR-n` |
| Baseline | Sprint mulai–selesai, `--tinta-2` |
| Rencana | Sprint mulai–selesai dengan tombol `−` / `+` untuk menggeser per sprint (lebih andal daripada seret, terutama di layar sentuh) |
| Selisih | Kosong bila sama; "+1 sprint" `--waspada` bila mundur |
| Progres | Input persen (langkah 10) + bilah 4px `--nila` |

### 6.9 Matriks Risiko 5×5

```
            Kemungkinan →
            1     2     3     4     5
Dampak 5 │     │     │  1  │     │  2  │
       4 │     │     │     │  1  │     │
       3 │     │  2  │     │     │     │
       2 │  1  │     │  3  │     │     │
       1 │     │     │     │     │     │
```

| Skor (dampak × kemungkinan) | Latar sel |
|---|---|
| 1–7 (rendah) | `--permukaan`, border `--garis` |
| 8–14 (sedang) | `--waspada-tipis` |
| ≥ 15 (tinggi) | `--kritis-tipis` |

- Sel berisi jumlah risiko (tabular, tebal); sel kosong tidak berisi angka.
- Klik sel menyaring daftar RAID di bawahnya; sel aktif diberi garis luar 2px `--nila`. Klik lagi untuk menghapus filter.
- Ukuran sel 44 × 44px agar mudah diklik.

### 6.10 Status Manual

```
● Kuning · Ditetapkan PM
Ditetapkan PM: vendor API belum siap, menunggu konfirmasi 2 Des.
[Kembalikan ke otomatis]
```

- Badge status ditambah teks "· Ditetapkan PM" dalam `--tinta-2`, agar terbedakan dari status otomatis.
- Alasan selalu tampil penuh di bawah badge pada halaman proyek, dan satu baris di dashboard.

### 6.11 Draf AI

**Pratinjau sebelum kirim (modal):**

```
Susun draf fitur dengan AI
Dikirim ke: [penyedia] · [model]

┌──────────────────────────────────────────────┐
│ Proyek: [Proyek]                             │
│ Kebutuhan: aplikasi kasir dengan ...         │  ← dapat diedit
│ Peran: Backend, Frontend, QA, UI/UX          │
└──────────────────────────────────────────────┘
[✓] Samarkan nama klien dan proyek
Rate, biaya, dan harga tidak pernah dikirim.

                              [Batal]  [Kirim ke AI]
```

**Hasil di tabel estimasi:**

```
│ Draf AI │ Riwayat transaksi    12   8   4   ▬    [Setujui]
│ Draf AI │ Cetak struk           6   6   2   ▬    [Setujui]
                                   [Setujui semua]  [Buang semua draf]
```

- Baris draf diberi garis kiri putus-putus 2px `--nila` dan label "Draf AI" (`--teks-mini`, latar `--nila-tipis`).
- Baris draf ikut dihitung di panel ringkasan, tetapi panel menampilkan catatan "Termasuk 6 fitur draf AI yang belum ditinjau".
- Estimasi tidak dapat ditandai final selama masih ada draf AI.
- Saat menunggu: teks "Menyusun draf…" dengan tombol "Batalkan", tanpa animasi berlebihan.
- Pesan gagal: "AI tidak merespons dalam 30 detik. Tidak ada yang tersimpan; coba lagi atau isi manual."

### 6.12 Keadaan Terkunci

Berlaku untuk estimasi final, baseline proyek, keputusan CR, laporan terkirim, dan keputusan yang sudah dibatalkan.

- Nilai ditampilkan sebagai teks biasa, bukan input yang dinonaktifkan (abu-abu), agar tetap mudah dibaca dan dicetak.
- Kop menampilkan badge netral: "◆ Final", "Terkirim · 24 Nov 2026", "Disetujui · 20 Nov 2026", atau "Dibatalkan oleh K-7".
- Aksi yang masih mungkin ditampilkan jelas, misalnya "Buat versi baru" atau "Buat keputusan pembatal".
- Penomoran `K-n` dan `CR-n` ditulis tabular dalam `--tinta-2`, dan selalu berupa tautan ke itemnya.

### 6.13 Laporan Mingguan (Cetak)

- Aturan cetak sama dengan ringkasan direksi (5.4): A4, margin 18mm, terbaca hitam-putih.
- **Template Direksi:** satu halaman: status dan alasan, progres vs rencana, proyeksi selesai, tiga risiko teratas, CR dan keputusan minggu ini, bantuan yang dibutuhkan.
- **Template Teknis:** boleh lebih dari satu halaman; kop (nama proyek, periode, halaman n/m) diulang di setiap halaman; tabel tidak terpotong di tengah baris.
- Narasi PM dicetak sebagai paragraf biasa, bukan kotak berbingkai.

## 7. Format Data

| Jenis | Format | Contoh |
|---|---|---|
| Rupiah di tabel | Lengkap, titik ribuan | Rp279.450.000 |
| Rupiah di ringkasan | Disingkat, satu desimal | Rp279,5 jt · Rp1,2 M |
| Desimal | Koma | 3,75 sprint |
| Persentase | Tanpa spasi | 15% |
| Tanggal | Singkat | 26 Nov 2026 |
| Rentang | Tanda pisah tanpa spasi | 5–7 sprint |
| Effort | Dua satuan saat relevan | 96 SP ≈ 48 jam |

---

## 8. Ikon dan Gerak

### 8.1 Ikon

- Set: **Lucide**, stroke 1,5px, ukuran 16px (inline) dan 20px (navigasi).
- Ikon hanya dipakai jika membantu pengenalan cepat (navigasi, status, aksi berulang). Tidak menambahkan ikon di setiap judul.

### 8.2 Gerak

- Gerak hanya muncul sebagai **respons terhadap aksi pengguna**.
- Saat angka di panel ringkasan berubah, angka tersebut berkedip lembut dengan latar `--nila-tipis` selama 600ms, sehingga terlihat apa yang terdampak oleh perubahan input.
- Pita rentang bergeser halus (200ms, ease-out) saat nilainya berubah.
- Tidak ada animasi masuk halaman, efek parallax, atau gerak dekoratif.
- `prefers-reduced-motion`: semua transisi dimatikan, perubahan langsung ditampilkan.

---

## 9. Penulisan di Antarmuka

| Aturan | Contoh benar | Hindari |
|---|---|---|
| Kata kerja aktif dan spesifik | Simpan estimasi | Submit, OK |
| Bahasa pengguna, bukan bahasa sistem | Tandai sebagai final | Set is_final = true |
| Error menjelaskan apa dan bagaimana memperbaiki | Rate Backend belum diisi. Tambahkan di Pengaturan → Rate. | Terjadi kesalahan. |
| Halaman kosong mengajak bertindak | Belum ada prospek. Catat calon proyek pertama untuk mulai mengestimasi. | Tidak ada data. |
| Istilah konsisten | Selalu "prospek", "estimasi", "skenario" | Bergantian "lead", "calon", "opportunity" |

Istilah teknis PM (sprint, story point, PERT, contingency) tetap dipakai di area kerja. Di ringkasan direksi, sertakan padanan bisnis: "6 sprint (± 3 bulan)".

---

## 10. Aksesibilitas dan Responsif

- Kontras teks minimal AA (lihat 2.3).
- Fokus keyboard selalu terlihat; urutan tab mengikuti urutan baca.
- Status tidak pernah hanya bergantung pada warna.
- Target sentuh minimal 44 × 44px pada layar sentuh.
- Breakpoint: **≥ 1280px** penuh; **1024–1279px** sidebar menciut; **768–1023px** panel ringkasan menjadi bar bawah; **< 768px** satu kolom, editor estimasi menjadi mode baca dengan pengeditan per fitur.

---

## 11. Token CSS

```css
:root {
  color-scheme: light;

  /* Warna */
  --kertas: #F4F5F1;
  --permukaan: #FFFFFF;
  --tinta: #1C2230;
  --tinta-2: #596273;
  --garis: #DCDFD8;
  --nila: #2D3A6E;
  --nila-sedang: #AEB6D9;
  --nila-tipis: #E3E6F2;
  --teks-di-nila: #FFFFFF;

  --aman: #276B44;      --aman-tipis: #E8F3EC;
  --waspada: #8A5A12;   --waspada-ikon: #B7791F;  --waspada-tipis: #FBF1DF;
  --kritis: #B42318;    --kritis-tipis: #FBE9E7;

  /* Tipografi */
  --font: "IBM Plex Sans", "Segoe UI", system-ui, -apple-system, sans-serif;
  --teks-angka-besar: 39px;
  --teks-h1: 31px;
  --teks-h2: 25px;
  --teks-h3: 20px;
  --teks-isi: 15px;
  --teks-kecil: 13px;
  --teks-mini: 12px;

  /* Jarak */
  --jarak-1: 4px;  --jarak-2: 8px;  --jarak-3: 12px;  --jarak-4: 16px;
  --jarak-6: 24px; --jarak-8: 32px; --jarak-12: 48px;

  /* Bentuk */
  --radius-kecil: 6px;
  --radius-panel: 10px;
  --bayangan-melayang: 0 8px 24px rgba(28, 34, 48, 0.12);

  /* Gerak */
  --durasi-cepat: 200ms;
  --durasi-sorot: 600ms;
}

body {
  font-family: var(--font);
  font-size: var(--teks-isi);
  line-height: 1.55;
  color: var(--tinta);
  background: var(--kertas);
}

.angka { font-variant-numeric: tabular-nums; }

@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}
```

Catatan: `color-scheme: light` dipasang tetap agar kontrol bawaan browser (scrollbar, date picker) tidak berubah gelap mengikuti pengaturan sistem operasi.

---

## 12. Yang Tidak Dilakukan

Daftar ini membantu menjaga kesan minimalis tetap konsisten seiring bertambahnya fitur:

- Tidak ada gradasi, pola latar, atau ilustrasi dekoratif.
- Tidak ada kartu identik bertumpuk dengan bayangan di setiap bagian.
- Tidak ada lebih dari satu tombol primer per layar.
- Tidak ada warna status untuk hal yang bukan status.
- Tidak ada label huruf kapital semua atau label kecil berlebih di atas setiap judul.
- Tidak ada animasi yang tidak dipicu oleh aksi pengguna.
- Tidak ada kartu metrik besar di dashboard; angka ringkasan cukup berupa satu baris teks.
- Warna status tidak dipakai untuk bar Gantt; keterlambatan cukup ditandai label.

## 13. Keputusan Desain

| ID | Pertanyaan | Keputusan (v0.2) |
|---|---|---|
| D1 | Perlu logo? | Tidak. Cukup wordmark teks "PM Workspace". |
| D2 | Identitas perusahaan di ringkasan direksi? | Tidak. Proyek pribadi; ringkasan memakai gaya netral dengan warna nila. |
| D3 | Mode gelap? | Tidak. Hanya mode terang, tanpa pengganti tema. |

Belum ada pertanyaan desain terbuka. Pertanyaan baru dicatat di sini saat muncul selama development.
