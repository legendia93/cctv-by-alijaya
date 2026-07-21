# Konteks Proyek — Ringkasan (baca ini dulu)

Entry point konteks untuk melanjutkan pekerjaan di sesi baru. File konteks dipecah
per topik di folder ini:

> **Aturan folder ini:** `konteks/` menyimpan **apa yang NYATA terjadi & sudah jalan di
> `app/` sekarang** — keputusan yang diambil, kode yang diubah, bug yang diperbaiki,
> temuan lapangan. **Bukan** rencana, **bukan** analisa.
> Rencana/backlog → [`../plan/`](../plan/). Analisa awal → [`../analisa/`](../analisa/).
> Kalau suatu pekerjaan selesai, catat hasilnya di sini; kalau batal, hapus catatannya.

| File | Isi |
|------|-----|
| [00-ringkasan.md](00-ringkasan.md) | **Ini** — gambaran umum, status, cara jalan cepat |
| [01-deployment-1-container.md](01-deployment-1-container.md) | Keputusan 1 container, file Docker, kenapa bukan 2 |
| [02-dev-workflow.md](02-dev-workflow.md) | Cara jalan dev (nodemon), kredensial, perintah harian |
| [03-patch-app-clone.md](03-patch-app-clone.md) | Semua file app/ yang diubah/ditambah + alasannya |
| [04-streaming-transcode.md](04-streaming-transcode.md) | Cara kerja RTSP→HLS, transcode H.265, path MediaMTX |
| [05-membership-isolasi-user.md](05-membership-isolasi-user.md) | Sistem membership + perbaikan C1/C2/C3 |
| [06-temuan-lapangan.md](06-temuan-lapangan.md) | Temuan hardware nyata: NVR H.265 gagal decode, PTZ klaim palsu, disk E:\ |
| [07-tema-nothing-os.md](07-tema-nothing-os.md) | Redesign UI tema "Nothing OS" (token layer, shell, auth) |
| [08-ui-kamera-dvr-storage.md](08-ui-kamera-dvr-storage.md) | Poles UI Kamera/DVR (2 panel, modal bulk) + fix storage, rekaman, service worker |

Dokumentasi utama (bukan konteks sesi) ada di `docs/01..08-*.md`.

---

## Apa proyek ini

Men-dockerisasi aplikasi **CCTV Monitoring** (repo `alijayanet/cctv-monitoring`,
di-clone ke `app/`) dan menyesuaikannya untuk kebutuhan bisnis: **jual layanan cloud
CCTV ke pelanggan WiFi** (membership berbayar + public view).

- App = **monolith** Node.js/Express + EJS (backend & front-end web jadi satu di `app/`).
- Streaming via **MediaMTX** (RTSP→HLS) + **ffmpeg** (transcode H.265→H.264).
- DB = **SQLite** (`cameras.db`). Keputusan: tetap SQLite (lihat `docs/03-database-analysis.md`).

## Struktur folder

```
e:\Project\cctv\
├── app/                      # aplikasi (hasil clone, monolith) — SUDAH ADA PATCH kita
├── docs/
│   ├── analisa/              # analisa awal (arsitektur, tech stack, DB, audit)
│   ├── konteks/              # apa yang NYATA terjadi di app/ (folder ini)
│   ├── plan/                 # rencana & backlog (belum dikerjakan)
│   └── arsip/                # dokumen lama
├── data/                     # state persist (config, db, recordings) — TIDAK di-commit
├── docker/entrypoint.sh      # entrypoint 1-container
├── Dockerfile.allinone       # image aktif (1 container)
├── docker-compose.allinone.yml
├── docker-compose.dev.yml    # override dev (nodemon)
├── mediamtx.single.yml       # config MediaMTX (1 container)
├── config.docker.json        # template config
└── (arsip 2-container: Dockerfile, docker-compose.yml, mediamtx.docker.yml)
```

## Status sekarang (per akhir sesi)

- ✅ Deployment **1 container all-in-one** — teruji jalan, kamera H.264 & H.265 online.
- ✅ **Dev mode nodemon** aktif — edit kode auto-reload tanpa rebuild.
- ✅ **Sidebar** kamera diperbaiki (Daftar Kamera / Tambah RTSP / Tambah Embed).
- ✅ **Membership** diperbaiki (proteksi stream + enforcement expiry). C3 opsional via env.
- ✅ **Redesign UI tema "Nothing OS"** (monokrom + aksen merah, dot-matrix, light-default +
  dark). Shell admin + dashboard + kamera + halaman publik + auth. Token layer terpusat
  (`nothing.css` + `head_theme.ejs`). Detail: [07-tema-nothing-os.md](07-tema-nothing-os.md).
- ✅ **Halaman PTZ diperbaiki** (sesi 2026-07-21): stream preview stuck loading (URL pakai
  `cam_<id>`), endpoint PTZ yang benar, bug `cam.ptz` undefined (`socket hang up`), port
  ONVIF, + deteksi kapabilitas PTZ dengan override manual. ⚠️ Temuan: ONVIF kamera clone
  **mengklaim PTZ palsu** — deteksi otomatis tak bisa 100% akurat. Belum diuji dengan
  kamera PTZ asli (tak ada hardware-nya). Detail:
  [03-patch-app-clone.md](03-patch-app-clone.md).
- ✅ **Poles UI Kamera/DVR + fix storage** (sesi 2026-07-21): halaman DVR/APK dari wizard
  jadi **2 panel** (kiri merek · kanan konfigurasi) + baris info collapsible; form **bulk
  dipindah jadi modal** di Daftar Kamera; badge status beranimasi; latar dot-grid
  diperluas ke seluruh app; angka `.n-num` diganti ke mono (dot-matrix `5`/`8` ambigu).
  Fix: checkbox rekam tak tersimpan saat OFF, urutan kamera acak (`ORDER BY nama`),
  autofill kredensial, service worker cache CSS, dan **angka storage dashboard ≠ menu
  Storage** (`df /` vs disk rekaman). ⚠️ Terungkap cacat auto-cleanup — sudah diberi
  pengaman. Detail: [08-ui-kamera-dvr-storage.md](08-ui-kamera-dvr-storage.md).
- 🟢 Stack DEV sedang **berjalan** saat sesi ditutup: `cctv-allinone` (healthy) di
  http://localhost:3003, 5 kamera terdaftar (semua `enable_recording=0` / live-only).

## Jalan cepat di sesi baru

```bash
cd /e/Project/cctv
# cek apakah container masih jalan
docker compose -f docker-compose.allinone.yml ps

# kalau belum, jalankan DEV (auto-reload):
docker compose -f docker-compose.allinone.yml -f docker-compose.dev.yml up -d

# buka http://localhost:3003
```

Detail kredensial & perintah: [02-dev-workflow.md](02-dev-workflow.md).
