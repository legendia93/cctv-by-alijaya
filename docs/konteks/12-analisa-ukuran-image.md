# Analisa Ukuran Image — kenapa 2.39 GB & cara menyusutkannya

Diukur 2026-07-21 pada `cctv-allinone:latest` (= `10.10.17.6:5000/cctv-allinone:v1.0.0/v1.0.1`).
Semua angka hasil `docker history` + `du` di dalam container, bukan perkiraan.

**Total: 2.39 GB.** Berat wajar untuk image ini sekitar **~900 MB–1.1 GB**; sisanya lemak
yang bisa dibuang tanpa mengubah fitur.

---

## Rincian layer terbesar

| Layer | Ukuran | Isi |
|-------|--------|-----|
| `apt-get install` | **784 MB** | ffmpeg, python3, **make, g++**, sqlite3, tini, dll |
| `npm install --omit=dev` | **708 MB** | node_modules (terpasang 490 MB, layer lebih besar krn cache build) |
| base `node:20-bookworm-slim` | ~219 MB | Debian bookworm + Node 20 + yarn |
| MediaMTX 1.16.1 | 48.7 MB | binary streaming |
| `npm install -g nodemon` | 6.08 MB | **hanya untuk DEV_MODE, tak dipakai di prod** |
| `COPY app/` | 4.46 MB | source code |

### node_modules (490 MB terpasang) — 10 besar

| Paket | Ukuran | Status |
|-------|--------|--------|
| **`@tensorflow`** | **272 MB** | ❌ **TIDAK DIPAKAI SAMA SEKALI** |
| **`ffmpeg-static`** | **77 MB** | ⚠️ duplikat — ffmpeg sistem sudah ada |
| `@img` (sharp) | 27 MB | transitif |
| `core-js` | 14 MB | transitif (dibawa tensorflow) |
| **`@whiskeysockets`** (Baileys) | **12 MB** | ✅ **kecil — bukan masalah** |
| `es-abstract` | 11 MB | transitif |
| `sqlite3` | 5.9 MB | dipakai |
| `lodash` / `xml2js` / `protobufjs` | 3–5 MB | transitif |

---

---

## ✅ HASIL EKSEKUSI TAHAP 1 (2026-07-21)

`@tensorflow/*` + `ffmpeg-static` **sudah dihapus** dari `package.json` + lock file.

| | Sebelum | Sesudah | Selisih |
|---|---|---|---|
| **Image** | 2.39 GB | **1.67 GB** | **−720 MB (−30%)** |
| **node_modules** | 490 MB | **124 MB** | **−366 MB (−75%)** |

Lebih besar dari perkiraan (377 MB) karena transitif ikut terbuang: `core-js` 14 MB,
`protobufjs`, dan lain-lain yang hanya dibawa TensorFlow.

**Pengujian pada `cctv-allinone:slim` — semua lulus:**
- Semua modul load, termasuk 2 native paling rawan: `sqlite3` ✅, `bcrypt` ✅
  (`[bcryptCompat] Native bcrypt OK - using native`)
- `baileys`, `onvif`, `express`, `ejs`, `web-push`, `telegram`, `qrcode` ✅
- `/usr/bin/ffmpeg` tersedia (v5.1.9) — jalur fallback YouTube stream aman
- Container **healthy**, `GET /login` → **HTTP 200**, MediaMTX v1.16.1 listener terbuka

## ✅ HASIL EKSEKUSI TAHAP 2 — MULTI-STAGE (2026-07-21)

[../../Dockerfile.allinone](../../Dockerfile.allinone) diubah jadi **2 stage**.

| | Awal | Tahap 1 | **Tahap 2** |
|---|---|---|---|
| **Image** | 2.39 GB | 1.67 GB | **1.2 GB** |
| Total hemat | — | −720 MB | **−1.19 GB (−50%)** |

Cara kerjanya: stage `builder` punya `make`/`g++`/`python3` untuk meng-compile modul
native, lalu **hanya `node_modules` hasilnya** yang disalin ke stage runtime via
`COPY --from=builder`. Toolchain ditinggal & dibuang bersama stage-nya.

**Diverifikasi toolchain benar-benar hilang** dari image final:
`which g++ make python3` → tidak ada; `/usr/lib/gcc` (120 MB) → tidak ada.

**Pengujian `cctv-allinone:multistage` — semua lulus:**
- `sqlite3` **baca-tulis nyata** (CREATE/INSERT/SELECT → 42) ✅ — bukan sekadar load
- `bcrypt` **hash + verify** → `true` ✅
- 15 modul load bersih: baileys, onvif, express, ejs, web-push, telegram, qrcode,
  pino, qrcode-terminal, body-parser, cors, express-session
- Container **healthy**, `GET /login` → **HTTP 200**
- `[bcryptCompat] Native bcrypt OK - using native`
- `npx nodemon` v3.1.14 tetap ada (dipakai entrypoint saat `DEV_MODE=1`)
- ffmpeg v5.1.9 tersedia

### Jebakan yang ditemukan saat mengerjakan
- **Basis kedua stage wajib sama persis** (`node:20-bookworm-slim`). Binding `.node`
  terikat glibc + versi Node + arsitektur. Kalau beda (mis. alpine/musl), image tetap
  ter-build tapi container **mati saat start**: `invalid ELF header`. Gagalnya di
  runtime, bukan build — karena itu wajib diuji lokal sebelum deploy.
- **`nodemon` tak boleh dihapus** meski "cuma untuk dev": entrypoint memanggil
  `npx nodemon` saat `DEV_MODE=1` ([../../docker/entrypoint.sh:30](../../docker/entrypoint.sh#L30)).
  Kalau hilang, dev mode mati.
- `.dockerignore` sudah mengecualikan `app/node_modules` (baris 8), jadi `COPY app/ ./`
  di akhir **tidak** menimpa hasil builder. Kalau baris itu dihapus, multi-stage bocor diam-diam.

> Belum di-deploy ke prod — user yang jalankan `scripts/deploy.sh` sendiri.
> Perlu naikkan tag versi saat deploy (`v1.0.1` → berikutnya).

---

## Temuan 1 — TensorFlow: 272 MB dependensi mati

`@tensorflow/tfjs` + `@tensorflow-models/coco-ssd` ada di
[app/package.json](../../app/package.json) tapi **tidak pernah di-`require` di mana pun**.
Diverifikasi dengan menyisir seluruh `require()` di semua `.js` non-node_modules: nol hasil
di luar `package.json` itu sendiri.

### Asal-usulnya: fitur AI deteksi kendaraan yang berhenti di tengah jalan

Ditelusuri 2026-07-21. Jejaknya ada di **[../../app/database_ai.js](../../app/database_ai.js)** —
"AI Vehicle Detection & Speed Measurement". File itu mendefinisikan 3 tabel:
`ai_speed_records` (kecepatan tiap kendaraan), `ai_vehicle_counts` (hitung per periode),
`ai_detection_zones` (konfigurasi zona).

Rencananya: `coco-ssd` (model deteksi objek siap pakai — mengenali car/truck/motorcycle)
dijalankan oleh `@tensorflow/tfjs` → lacak perpindahan antar frame → hitung kecepatan.

**Kenapa mati:** fiturnya berhenti di tahap skema DB. Tidak pernah ada kode inferensinya.
- `database_ai.js` sendiri **yatim piatu** — tak pernah di-`require` dari mana pun, jadi
  `migrateAiTables()` di baris 169 tak pernah jalan; tabelnya bahkan tak pernah dibuat.
- Tak ada view, route, atau UI terkait AI.
- **Bawaan repo asli** (`alijayanet/cctv-monitoring`) — sudah ada sejak commit pertama
  (`953057d`), bukan sisa pekerjaan kita.

> Catatan teknis: `@tensorflow/tfjs` itu varian **browser**. Untuk inferensi di server Node
> mestinya `@tensorflow/tfjs-node`. Jadi kalaupun fitur ini diteruskan nanti, paket ini
> kemungkinan bukan yang tepat dan perlu diganti.

Ini penyumbang tunggal terbesar, dan menyeret transitif (`core-js` 14 MB,
`protobufjs` 3.4 MB, dll).

**Buang → hemat ~272 MB langsung, plus transitif ≈ 300+ MB.**
Kalau fitur AI mau dikerjakan suatu hari, `package.json` tinggal ditambah lagi.

## Temuan 2 — ffmpeg dobel: 77 MB mubazir

Image punya **dua** ffmpeg:
- `/usr/bin/ffmpeg` dari apt — **288 KB** (binary tipis, library-nya shared)
- `/app/node_modules/ffmpeg-static/ffmpeg` — **79.8 MB** (binary statis, semua library di dalam)

[app/youtube_stream.js:17-19](../../app/youtube_stream.js#L17) memakai `ffmpeg-static`
**dengan fallback ke ffmpeg sistem** kalau modul tak ada. Jadi menghapusnya aman —
kodenya sudah siap jatuh ke `/usr/bin/ffmpeg`.

**Buang → hemat 77 MB.**

## Temuan 3 — toolchain build ikut terkirim: ~120 MB

`make` + `g++` + `python3` dipasang untuk meng-compile modul native (`sqlite3`, `bcrypt`)
saat `npm install`. Tapi setelah compile selesai **tidak dibutuhkan lagi saat runtime** —
sekarang ikut terbawa selamanya. `/usr/lib/gcc` sendiri **120 MB**.

Ini yang membuat layer apt membengkak jadi 784 MB.

**Solusi: multi-stage build** — compile di stage builder, salin hanya `node_modules`
hasilnya ke stage runtime yang tak punya g++.

## Temuan 4 — nodemon di image prod

`npm install -g nodemon` (6 MB) hanya berguna saat `DEV_MODE`. Kecil, tapi tak perlu ada
di image produksi.

---

## Jawaban: WA gateway pakai apa? Perlu diganti?

**Pakai Baileys** (`@whiskeysockets/baileys ^7.0.0-rc10`), dipakai di
[app/whatsapp_bot.js:1](../../app/whatsapp_bot.js#L1).

**Tidak perlu diganti — Baileys BUKAN penyebab image besar.**
Ukurannya hanya **12 MB** dari 490 MB node_modules — sekitar **2.4%**. Dugaan bahwa
WA gateway yang bikin berat tidak terbukti; tersangka sebenarnya TensorFlow (272 MB),
yang bahkan tidak dipakai.

Baileys juga pilihan tepat secara arsitektur: pure JS, tanpa browser headless. Alternatif
seperti `whatsapp-web.js` justru **jauh lebih berat** karena menyeret Puppeteer + Chromium
(~300–400 MB) dan boros RAM. Mengganti Baileys = image lebih besar, bukan lebih kecil.

> Catatan: ada `whatsapp-rust-bridge` (2 MB) sebagai transitif Baileys v7 — normal, bukan
> instalasi terpisah.

---

## Rencana perbaikan (urut dampak per usaha)

| # | Tindakan | Hemat | Risiko |
|---|----------|-------|--------|
| 1 | Hapus `@tensorflow/tfjs` + `@tensorflow-models/coco-ssd` dari `package.json` | **~300 MB** | **Nol** — tak dipakai |
| 2 | Hapus `ffmpeg-static` | **77 MB** | Rendah — fallback sudah ada di kode |
| 3 | Multi-stage build (buang `make`/`g++`/`python3` dari runtime) | **~150 MB** | Sedang — perlu tes modul native |
| 4 | `nodemon` jangan di image prod (pindah ke stage dev / install saat DEV_MODE) | 6 MB | Nol |
| 5 | `npm ci --omit=dev` + `npm cache clean --force` | ~50 MB | Nol |

**Estimasi hasil: 2.39 GB → ~1.2–1.4 GB** (turun ~45%) tanpa kehilangan satu fitur pun.
Langkah 1+2 saja sudah memangkas ~377 MB dan bisa dikerjakan dalam hitungan menit.

### Catatan pelaksanaan
- Setelah ubah `package.json`, **`package-lock.json` harus ikut di-regenerate**
  (`npm install` lokal) supaya `npm ci` di Docker tidak gagal.
- `sqlite3` & `bcrypt` = modul native. Kalau multi-stage dipakai, pastikan stage builder
  dan runtime **sama persis** basis & arsitekturnya, kalau tidak binding `.node` gagal load.
- Uji setelah build: login, live view, rekam, bot WA connect, YouTube stream (jalur
  `ffmpeg-static` yang dihapus).

Rencana eksekusi ada di [`../plan/09-perampingan-image.md`](../plan/09-perampingan-image.md).
