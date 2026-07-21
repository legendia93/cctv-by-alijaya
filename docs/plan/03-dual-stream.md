# Plan 3 — Dual-Stream (Hemat CPU)

**Tujuan:** kamera pakai **main-stream H.265** untuk rekam (kualitas tinggi) + **sub-stream
H.264** untuk live view **tanpa transcode**. Menghemat CPU besar karena transcode H.265→H.264
untuk live dihilangkan.

**Kompleksitas:** Tinggi. Menyentuh path MediaMTX, logika transcode, schema, form, dan player.

## Kondisi sekarang
- Per kamera RTSP, app bikin **2 path**: `cam_X_input` (source dari kamera) + `cam_X`
  (hasil transcode/copy H.264 via `smart_transcode.sh`). Browser nonton `cam_X`.
- `smart_transcode.sh` deteksi codec: H.264 → copy (murah), H.265 → transcode (mahal CPU).
- Recording di path `cam_X` (H.264 hasil transcode). Lihat
  [04-streaming-transcode.md](../konteks/04-streaming-transcode.md).

## Ide desain (perlu keputusan sebelum eksekusi)
Kamera dual-stream mengekspos 2 URL RTSP: main (ch0/main) + sub (ch1/sub).

**Opsi A — Sub buat live, main buat rekam:**
- Path `cam_X` = **sub-stream H.264** (copy, tanpa transcode) → live view murah.
- Path `cam_X_rec` = **main-stream H.265** → rekam langsung (fmp4 mendukung H.265).
- Live player tetap nonton `cam_X`. Recording pindah ke `cam_X_rec`.
- **Hemat CPU maksimal** (tidak ada transcode sama sekali kalau sub sudah H.264).

**Opsi B — Sub live, main transcode utk rekam H.264:** lebih kompatibel player lama tapi
tetap transcode → kurang hemat. **Tidak disarankan** (mengalahkan tujuan).

→ **Rekomendasi: Opsi A.** Perlu konfirmasi player/HLS bisa serve H.265 utk arsip, atau arsip
cukup diunduh (bukan diputar in-browser). Cek dukungan playback arsip H.265 dulu.

## Perubahan yang direncanakan (Opsi A)

### A. Schema
- Tambah kolom: `url_rtsp_sub TEXT` (URL sub-stream). `url_rtsp` tetap = main.
- Flag `dual_stream INTEGER DEFAULT 0`.

### B. Form kamera
- Toggle **"Dual-stream"**. Saat ON: munculkan field **Sub-stream URL** + hint
  (mis. Hikvision main `.../Channels/101`, sub `.../Channels/102`).

### C. Logika path (index.js `registerCamera` + apply record)
- Jika `dual_stream`:
  - `cam_X` source = `url_rtsp_sub` (H.264), **runOnReady tanpa transcode** (copy saja).
  - `cam_X_rec` source = `url_rtsp` (H.265 main), `record: true` (hormati `enable_recording`).
- Jika tidak: perilaku lama (transcode adaptif).
- Sesuaikan `smart_transcode.sh` agar bisa mode "copy-only" untuk sub-stream.

### D. Player arsip
- Arsip sekarang = fmp4 H.264. Untuk dual-stream jadi H.265 → cek player HLS in-browser.
  Kalau tak didukung, sediakan **download** + transcode on-demand saat play (lazy).

## Titik uji
- Kamera H.265 dual-stream: `top`/`docker stats` → CPU turun signifikan vs transcode.
- Live `cam_X` jalan (sub H.264). Arsip terekam dari main (cek file di `recordings/cam_X_rec`).
- Fallback: kamera non-dual tetap jalan seperti sebelumnya.

## Risiko / catatan
- **Paling berisiko** dari 4 fitur. Kerjakan terakhir, setelah #1 & #2 stabil.
- Ketergantungan pada kamera yang benar-benar punya sub-stream H.264 — tidak semua punya.
- Playback arsip H.265 di browser = titik ketidakpastian; putuskan strategi arsip dulu.
- Migrasi schema: kolom baru `NULL`-safe; kamera lama `dual_stream=0` → path lama.
