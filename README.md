# PM Workspace

Spesifikasi: `PRD-PM-Workspace.md`, `design.md`, `tech-stack.md`.

## Menjalankan di lokal

Butuh Node.js LTS dan pnpm (`corepack enable pnpm`).

```sh
pnpm install
pnpm db:migrate            # membuat data/app.db
pnpm create-user <nama>    # membuat akun (password min. 12 karakter)
pnpm dev                   # http://localhost:5173
```

## Perintah

| Perintah | Kegunaan |
|---|---|
| `pnpm test` | Uji mesin kalkulasi, format, dan autentikasi |
| `pnpm check` | Pemeriksaan tipe |
| `pnpm db:generate --name <nama>` | Membuat file migrasi setelah mengubah `schema.ts` |
| `pnpm db:migrate` | Menerapkan migrasi |
| `pnpm db:studio` | Melihat isi database |
| `pnpm build` | Build produksi ke `build/` (`node build/index.js`) |

Lokasi database diatur lewat `DATABASE_PATH` (default `data/app.db`).

## Draf AI (opsional)

Isi di `.env` (tidak masuk git):

```
AI_API_KEY=...
AI_BASE_URL=https://.../v1   # endpoint chat completions kompatibel OpenAI
AI_MODEL=...                 # nama lama MODEL tetap dibaca
```

`pnpm dev` membaca `.env` otomatis. Build produksi tidak: jalankan dengan `node --env-file=.env build/index.js`.

Privasi (PRD F4): yang dikirim hanya nama proyek, kebutuhan, tujuan bisnis, catatan, dan nama peran. PM melihat dan boleh
mengedit teks persisnya sebelum dikirim, dan dapat menyamarkan nama klien/proyek. Hasil masuk sebagai "Draf AI" yang
wajib ditinjau sebelum estimasi final. Saklar dan log pemanggilan (tanpa isi teks) ada di Pengaturan → Draf AI.

## Struktur

- `src/lib/calc/` — mesin kalkulasi murni (PRD bagian 7), dipakai di browser dan server
- `src/lib/format/` — format Rupiah, desimal, dan tanggal Indonesia
- `src/lib/server/` — database (Drizzle + SQLite) dan autentikasi
- `src/styles/` — token dan komponen dasar dari `design.md`
