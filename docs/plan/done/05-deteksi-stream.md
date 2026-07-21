# Plan 5 — Deteksi Stream Terbaik (Auto-probe RTSP path)

**Tujuan:** bantu admin menemukan **path RTSP main-stream** kamera secara otomatis. Banyak
kamera mengekspos beberapa path (main-stream 1080p vs sub-stream 704×576); user sering tak
sadar memasukkan sub-stream sehingga live view rasio salah / resolusi rendah.

**Asal ide:** debugging bug SSN-01 — `rtsp://10.10.111.8/live/ch0` = sub-stream 704×576 (4:3),
sedangkan `rtsp://10.10.111.8/h264/ch1/main/av_stream` = main-stream 1920×1080 (16:9).
`ffprobe` dipakai untuk mengidentifikasi resolusi/codec tiap kandidat path.

**Lokasi (keputusan user):** **Form Tambah/Edit Kamera** — tombol di sebelah field URL RTSP.
**Perilaku (keputusan user):** **tampilkan daftar path valid + resolusi/codec, user pilih**
(bukan auto). Klik salah satu → isi field URL RTSP.

**Kompleksitas:** Sedang.

## Fakta kode terverifikasi
- Ada helper reusable **`execCmd(file, args, {timeout})`** ([index.js:5142](../../app/index.js#L5142))
  membungkus `execFile` — pakai ini untuk memanggil `ffprobe`.
- `ffprobe` tersedia di container (sudah dipakai manual saat debugging).
- Ada endpoint contoh `POST /api/dvr/test-rtsp` ([index.js:2031](../../app/index.js#L2031),
  `requireApiAuth`) — pola auth & respons JSON bisa ditiru.
- Form kamera field URL: `#edit_url_rtsp` di
  [admin_cameras.ejs:44-47](../../app/views/admin_cameras.ejs#L44) (dalam `#rtsp-fields`).

## Desain

### A. Backend — endpoint probe
Endpoint baru: `POST /api/rtsp/detect-streams` (**`requireApiAuth`**, admin only).

**Input** (fleksibel — terima IP saja atau URL lengkap):
```json
{ "input": "10.10.111.8" | "rtsp://user:pass@10.10.111.8:554/live/ch0",
  "username": "", "password": "", "port": 554 }
```
- Kalau `input` sudah `rtsp://…`: pecah jadi host/port/cred, gunakan sebagai basis.
- Kalau `input` cuma IP/host: bangun `rtsp://[user:pass@]host:port/` + kandidat path.

**Daftar kandidat path** (dari temuan + pola umum merek):
```
h264/ch1/main/av_stream        (main HEVC/H264 — pola Sekainet/XM/V380)
cam/realmonitor?channel=1&subtype=0   (Dahua main)
cam/realmonitor?channel=1&subtype=1   (Dahua sub)
Streaming/Channels/101         (Hikvision main)
Streaming/Channels/102         (Hikvision sub)
live/ch00_0  live/ch01_0  live/main  live/ch0  live/ch1
0/av0  11  12  stream1  stream2  h264Preview_01_main
```
> Simpan daftar ini di modul share `app/utils/rtspProbeCandidates.js` supaya mudah dirawat &
> bisa dipakai ulang (mis. plan #2 bulk DVR).

**Probe:**
- Untuk tiap kandidat: `ffprobe -v error -rtsp_transport tcp -select_streams v:0
  -show_entries stream=codec_name,width,height -of json <url>` via `execCmd` dgn
  **timeout pendek (4–5 dtk)**.
- **Jalankan PARALEL** (`Promise.all` / batch, mis. maks 6 sekaligus) supaya total cepat.
- **Pre-check reachability**: TCP connect ke `host:port` dulu (pola `test-rtsp`); kalau port
  tertutup → langsung balikan error, JANGAN probe 20 path (hindari 20× timeout).
- De-duplikasi hasil berdasarkan `width×height×codec` (path `live/ch0`==`live/ch1` sering sama).

**Output:**
```json
{ "reachable": true,
  "results": [
    { "path": "h264/ch1/main/av_stream", "url": "rtsp://.../h264/ch1/main/av_stream",
      "codec": "hevc", "width": 1920, "height": 1080, "ratio": "16:9", "label": "Main Stream" },
    { "path": "live/ch0", "url": "...", "codec": "h264", "width": 704, "height": 576,
      "ratio": "11:9", "label": "Sub Stream" }
  ] }
```
- Urutkan **resolusi tertinggi dulu**. Tandai yang `>=1280` sebagai kandidat main.
- Sertakan kredensial di `url` hasil (kalau user isi), supaya klik = langsung pakai.

**Keamanan / batas:**
- `requireApiAuth` wajib (endpoint melakukan koneksi keluar ke IP arbitrer → cegah abuse).
- Timeout total dibatasi (mis. 20 dtk keseluruhan). Batasi jumlah kandidat.
- Jangan log kredensial plain ke console.

### B. UI — form kamera
File: [admin_cameras.ejs](../../app/views/admin_cameras.ejs), dalam `#rtsp-fields`.
1. Tombol **"🔍 Deteksi Stream"** di sebelah/atas field URL RTSP.
2. Klik → ambil nilai field URL (atau IP), POST ke `/api/rtsp/detect-streams`, tampilkan
   **spinner** ("Memindai path stream…").
3. Render hasil sebagai **daftar kartu** di bawah field: tiap baris tampil
   `resolusi + codec + rasio + label (Main/Sub) + tombol "Pakai"`.
   - Highlight baris resolusi tertinggi (badge "Rekomendasi").
   - Peringatan halus kalau yang dipilih rasio bukan 16:9 (mis. "4:3 — mungkin sub-stream").
4. Klik "Pakai" → isi `#edit_url_rtsp` dengan `url` hasil, tutup daftar.
5. Kalau tak reachable / tak ada hasil → pesan jelas ("Port tertutup / butuh kredensial").
6. Sediakan field opsional **user/pass** untuk deteksi (banyak kamera butuh auth).

## Titik uji
- Input `10.10.111.8` → daftar berisi 1920×1080 (main) di atas & 704×576 (sub). Klik main →
  field terisi `rtsp://10.10.111.8/h264/ch1/main/av_stream`.
- Input IP tak reachable → error cepat (<6 dtk), bukan hang lama.
- Kamera ber-auth: tanpa cred gagal, dengan cred berhasil.

## Risiko / catatan
- **Latensi** = risiko utama. Wajib: pre-check TCP, probe paralel, timeout pendek, batasi
  kandidat. Tanpa ini UX buruk untuk kamera lambat/unreachable.
- Daftar kandidat tak pernah lengkap untuk semua merek — sediakan tetap input URL manual.
- Kalau nanti plan #2 (bulk DVR) jalan, share modul kandidat + probe.
