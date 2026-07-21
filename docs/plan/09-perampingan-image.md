# Plan — Perampingan Image (2.39 GB → ~1.2 GB)

> **✅ TAHAP 1 & 2 SELESAI 2026-07-21 — hasil nyata 2.39 GB → 1.2 GB (turun ~1.19 GB / 50%).**
> node_modules 490 MB → **124 MB**; toolchain build (~150 MB) tak lagi ikut terkirim.
> Semua pengujian lulus (native module, container healthy, HTTP 200).
> Detail + jebakan: [../konteks/12-analisa-ukuran-image.md](../konteks/12-analisa-ukuran-image.md).
> **Belum di-deploy ke prod** — perlu rebuild + naikkan tag versi.
> Sisa: Tahap 3 (opsional, alpine) — **tidak disarankan**, lihat bawah.

Analisa lengkap + angka ukuran ada di
[../konteks/12-analisa-ukuran-image.md](../konteks/12-analisa-ukuran-image.md) — baca itu dulu.

Ringkas: penyebab utama **bukan** WA gateway (Baileys cuma 12 MB), tapi **TensorFlow
272 MB yang tidak dipakai sama sekali**, ffmpeg dobel 77 MB, dan toolchain build
(`g++`/`make`) ~150 MB yang ikut terkirim ke runtime.

---

## ✅ Tahap 1 — Buang dependensi mati — SELESAI

Hemat nyata **720 MB** (perkiraan awal 377 MB — transitif ikut terbawa).

- [x] Hapus dari [../../app/package.json](../../app/package.json):
      `@tensorflow/tfjs`, `@tensorflow-models/coco-ssd` — **tak pernah di-`require`**
      (diverifikasi menyisir semua `require()` di `app/**/*.js`).
- [x] Hapus `ffmpeg-static` — duplikat `/usr/bin/ffmpeg` (288 KB) yang sudah dipasang apt.
      [../../app/youtube_stream.js:15-29](../../app/youtube_stream.js#L15) `require`-nya
      dibungkus `try/catch` **dan** `ffmpeg-static` justru prioritas TERAKHIR di daftar
      `pathsToTest` — `ffmpeg` sistem dicoba lebih dulu, jadi perilaku tak berubah.
- [x] Regenerate `package-lock.json` (`npm install --package-lock-only`) —
      diverifikasi nol sisa referensi tensorflow/ffmpeg-static.
- [x] Rebuild + uji (lihat hasil pengujian di konteks/12).

## ✅ Tahap 2 — Multi-stage build — SELESAI

Hasil: **1.67 GB → 1.2 GB**. Total dari awal: **2.39 GB → 1.2 GB (−50%)**.

- [x] Pecah [../../Dockerfile.lookna](../../Dockerfile.lookna) jadi 2 stage
      (builder dengan toolchain → runtime tanpa toolchain).
- [x] Basis kedua stage sama persis (`node:20-bookworm-slim`).
- [x] `npm cache clean --force` setelah install.
- [x] Uji modul native: `sqlite3` baca-tulis nyata ✅, `bcrypt` hash+verify ✅,
      container healthy + HTTP 200 ✅.
- [x] ⚠️ **`nodemon` TETAP dipertahankan** — rencana awal mau dibuang, ternyata
      entrypoint memanggilnya via `npx nodemon` saat `DEV_MODE=1`. Kalau dihapus,
      dev mode mati.

Detail + jebakan yang ditemukan: [../konteks/12-analisa-ukuran-image.md](../konteks/12-analisa-ukuran-image.md).

## Tahap 3 — Opsional

- [ ] Tinjau `.dockerignore` — pastikan `node_modules` lokal, `recordings/`, `.git`
      tidak ikut masuk build context.
- [ ] Pertimbangkan `node:20-alpine` (basis ~50 MB vs ~219 MB). **Hati-hati**: musl vs
      glibc bisa menyulitkan compile modul native & ffmpeg. Hanya kalau tahap 1–2 kurang.

---

## Target & verifikasi

| Titik | Ukuran |
|-------|--------|
| Sekarang | 2.39 GB |
| Setelah tahap 1 | ~2.0 GB |
| Setelah tahap 2 | **~1.2–1.4 GB** |

Cek hasil: `docker images --format "{{.Repository}}:{{.Tag}}\t{{.Size}}" | grep cctv`

> Deploy ke prod: **user yang jalankan script deploy sendiri** — jangan ssh ke
> `10.10.17.6` tanpa izin (lihat aturan consent prod).
