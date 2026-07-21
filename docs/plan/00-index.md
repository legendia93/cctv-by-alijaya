# Plan — Fitur Lanjutan (belum dieksekusi)

Kumpulan rencana kerja. **Belum dikerjakan** — plan dulu, eksekusi menyusul satu per satu.
Urutan pengerjaan mengikuti kompleksitas naik.

| # | Fitur | File plan | Kompleksitas | Status |
|---|-------|-----------|--------------|--------|
| 1 | Record per kamera | [done/01-record-per-kamera.md](done/01-record-per-kamera.md) | Rendah | ✅ done |
| 2 | Bulk add channel DVR/NVR | [done/02-bulk-add-dvr.md](done/02-bulk-add-dvr.md) | Sedang | ✅ done |
| 3 | Dual-stream (hemat CPU) | [03-dual-stream.md](03-dual-stream.md) | Tinggi | 📋 planned |
| 4 | Poles UI kamera | [done/04-poles-ui-kamera.md](done/04-poles-ui-kamera.md) | Rendah | ✅ done (A,C,D,E + 2-kolom, modal, peta kecil, toggle rekam) |
| 5 | Deteksi stream terbaik (auto-probe RTSP) | [done/05-deteksi-stream.md](done/05-deteksi-stream.md) | Sedang | ✅ done |
| 6 | Redesign UI — tema Nothing OS (feel human, bukan AI-generated) | [done/06-redesign-ui-nothing.md](done/06-redesign-ui-nothing.md) | Tinggi | ✅ done (token layer, shell, dashboard, kamera, publik, auth; hasil di [konteks/07](../konteks/07-tema-nothing-os.md)) |
| 8 | Ganti logo, icon & OG image (preview link WA) | [08-logo-icon-og-image.md](08-logo-icon-og-image.md) | Rendah | ⏸️ kode selesai — **nunggu aset gambar dari user** |
| 9 | Perampingan image 2.39 GB → ~1.2 GB | [09-perampingan-image.md](09-perampingan-image.md) | Sedang | 📋 planned (analisa selesai: [konteks/12](../konteks/12-analisa-ukuran-image.md)) |

> Plan yang **✅ done** file-nya dipindah ke [`done/`](done/). Tabel di atas tetap
> mencantumkan semua untuk jejak historis.

Selain plan bernomor di atas, ada **[07-backlog.md](07-backlog.md)** — kumpulan hal yang
belum dikerjakan (ditunda, opsional, prod-readiness). Dipindah dari `konteks/06-todo-next.md`
pada 2026-07-21 agar folder `konteks/` murni berisi apa yang sudah terjadi.

## Aturan kerja
- Kerjakan **satu per satu**, urut dari #1.
- **Prioritas: bug yang ditemukan user dikerjakan lebih dulu** sebelum fitur ini.
- Setelah tiap fitur selesai: update status di tabel ini + catat perubahan di
  [../konteks/03-patch-app-clone.md](../konteks/03-patch-app-clone.md).

## Fakta kode terverifikasi (dasar semua plan)
- Schema `cameras` sudah punya kolom **`enable_recording INTEGER DEFAULT 1`** + index
  `idx_cameras_recording`. Belum dipakai untuk kontrol MediaMTX.
- Recording MediaMTX di-set di `applyRecordingSettings`-style block sekitar
  [index.js:823-839](../../app/index.js#L823) — loop semua kamera, set `record: shouldRecord`
  (global window on/off), **belum** per-kamera.
- Route tambah kamera: `POST /admin/camera/add` ([index.js:3296](../../app/index.js#L3296)),
  edit `POST /admin/camera/edit` ([index.js:3356](../../app/index.js#L3356)).
- Form kamera: [app/views/admin_cameras.ejs](../../app/views/admin_cameras.ejs) (baru direfaktor:
  form hidden default, dibuka via tombol "Tambah Kamera").
- DVR/NVR: [app/views/admin_dvr_apk.ejs](../../app/views/admin_dvr_apk.ejs) sudah punya
  **template RTSP per-brand dengan token `{channel}`** (~baris 530+). Menu APK & P2P
  disembunyikan dari sidebar (route masih ada).
