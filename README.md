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
MODEL=...
```

`pnpm dev` membaca `.env` otomatis. Build produksi tidak: jalankan dengan `node --env-file=.env build/index.js`.
Yang dikirim ke AI hanya nama proyek, kebutuhan, tujuan bisnis, catatan tambahan, dan nama peran; rate, harga, dan
kontak klien tidak pernah dikirim.

## Struktur

- `src/lib/calc/` — mesin kalkulasi murni (PRD bagian 7), dipakai di browser dan server
- `src/lib/format/` — format Rupiah, desimal, dan tanggal Indonesia
- `src/lib/server/` — database (Drizzle + SQLite) dan autentikasi
- `src/styles/` — token dan komponen dasar dari `design.md`
