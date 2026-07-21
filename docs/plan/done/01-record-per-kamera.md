# Plan 1 — Record per Kamera

**Tujuan:** izinkan admin memilih kamera mana yang direkam, mana yang live-only.
Berguna untuk paket jualan **live-only vs live+rekam**.

**Kompleksitas:** Rendah. Kolom DB sudah ada, tinggal dipakai + toggle di UI.

## Kondisi sekarang
- `cameras.enable_recording INTEGER DEFAULT 1` sudah ada tapi **tidak dipakai** untuk
  mengontrol MediaMTX.
- Recording = global window on/off. Loop di [index.js:823-839](../../app/index.js#L823)
  set `record: shouldRecord` untuk **semua** kamera (`shouldRecord = rec.enabled && isInsideWindow`).
- Route add ([index.js:3340-3342](../../app/index.js#L3340)) meng-insert `enable_recording` hardcoded `1`.
- Route edit belum meng-update `enable_recording` sama sekali.
- Form kamera belum punya toggle recording.

## Perubahan yang direncanakan

### A. Backend — hormati `enable_recording` saat apply MediaMTX
File: [app/index.js](../../app/index.js) sekitar baris 823-839.
1. Ubah query: `SELECT id FROM cameras` → `SELECT id, enable_recording FROM cameras`.
2. Ubah `record: shouldRecord` → `record: shouldRecord && (cam.enable_recording !== 0)`.
   (default 1 → kamera lama tetap terekam; hanya yang di-set 0 yang live-only.)

### B. Backend — simpan toggle dari form
1. `POST /admin/camera/add` (RTSP branch, [index.js:3340](../../app/index.js#L3340)):
   ambil `enable_recording` dari body (default 1), pakai di INSERT.
   *(Embed branch biarkan logika `isHls` yang sudah ada.)*
2. `POST /admin/camera/edit`: tambah `enable_recording = ?` di UPDATE branch RTSP.
3. Setelah add/edit RTSP, panggil ulang apply-recording (atau `registerCamera`) supaya
   MediaMTX langsung sinkron tanpa nunggu cron window berikutnya. **Cek dulu**: apakah
   `registerCamera` memicu re-apply record? Kalau tidak, panggil fungsi apply record.

### C. UI — toggle di form kamera
File: [app/views/admin_cameras.ejs](../../app/views/admin_cameras.ejs).
1. Tambah checkbox/switch **"Rekam ke storage"** di `#rtsp-fields` (hanya untuk tipe RTSP;
   embed tidak relevan). Default checked.
2. Kirim sebagai `enable_recording` (`1`/`0`) di form submit.
3. Saat Edit: set state checkbox dari `data-enable_recording` (tambah data-attr di tombol edit
   [admin_cameras.ejs:155-159](../../app/views/admin_cameras.ejs#L155)).
4. Opsional: badge "REC"/"LIVE" di baris tabel daftar kamera.

## Titik uji (verifikasi)
- Add kamera RTSP dengan toggle OFF → `enable_recording=0` di DB → cek MediaMTX path
  `cam_X` punya `record: false` via `/v3/config/paths/get/cam_X`.
- Toggle ON → `record: true` (saat di dalam window).
- Edit kamera existing dari ON→OFF → MediaMTX ikut berubah.

## Risiko / catatan
- Recording tetap tunduk pada **global window** (`rec.enabled` + jam). Per-kamera hanya
  bisa **mematikan**, tidak bisa merekam di luar window global. (Sesuai desain sekarang.)
- Jangan lupa index `idx_cameras_recording` sudah ada — query filter murah.
