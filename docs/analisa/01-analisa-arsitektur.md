# Analisa Arsitektur & Kode

Sumber: repo [`alijayanet/cctv-monitoring`](https://github.com/alijayanet/cctv-monitoring)
(di-clone ke [`../app`](../app)). Versi aplikasi: **2.1.0**.

---

## 1. Gambaran umum

Aplikasi **web monitoring CCTV** berbasis Node.js. Sifatnya **monolith**: satu proses
Express yang sekaligus:

- menyajikan **API** (JSON) untuk data kamera/rekaman/user,
- me-render **front-end web** langsung dari server memakai template **EJS**
  ([`app/views`](../app/views)) + aset statis ([`app/public`](../app/public)),
- mengorkestrasi **MediaMTX** (server streaming) lewat HTTP API-nya,
- menjalankan **bot** (WhatsApp/Telegram), **notifikasi push**, dan **YouTube live**.

Jadi tidak ada pemisahan front-end/back-end terpisah — front-end-nya adalah web yang
di-render server (server-side rendered).

## 2. Alur data streaming (inti sistem)

```
IP Camera (RTSP)
      │  rtsp://user:pass@ip:554/stream
      ▼
  MediaMTX  ──► rekam ke ./recordings (fmp4, segmen 60m)
      │  transmux
      ▼
  HLS (port 8856)  ◄── browser memutar via hls.js
      ▲
      │  Node app (port 3003) mem-proxy HLS same-origin + kontrol via API (port 9123)
      ▼
  Browser (dashboard EJS)
```

- **MediaMTX** = jantung streaming: menerima RTSP dari kamera, mengubah ke HLS untuk
  browser, dan menulis rekaman ke disk. App **tidak** memproses video sendiri untuk
  playback; ia mengontrol MediaMTX via REST API (`:9123`).
- **FFmpeg** dipakai untuk transcoding (H.265→H.264) dan **YouTube livestream**
  (`youtube_stream.js`), bukan untuk playback normal.

## 3. Struktur kode

| Path | Peran |
|------|-------|
| [`app/index.js`](../app/index.js) | Entry point. Express app, semua route web+API (± 238 KB, file besar) |
| [`app/database.js`](../app/database.js) | Koneksi SQLite + pembuatan tabel + migrasi kolom inline |
| [`app/database_ai.js`](../app/database_ai.js) | Tabel & query fitur AI (deteksi objek, kendaraan) |
| [`app/config.json`](../app/config.json) | Konfigurasi runtime (port, kredensial, mediamtx, recording, bot) |
| [`app/mediamtx.yml`](../app/mediamtx.yml) | Konfigurasi MediaMTX (port RTSP/HLS/API, path rekaman) |
| [`app/views/`](../app/views) | Template EJS (dashboard, admin, login, dll) — **front-end** |
| [`app/public/`](../app/public) | CSS, JS (hls.js, leaflet), ikon, manifest PWA |
| [`app/services/`](../app/services) | Logika: activity logger, permission/level, storage, config manager |
| [`app/utils/`](../app/utils) | Helper: mediamtx, middleware, embed camera, alerts, storage |
| [`app/middleware/`](../app/middleware) | Middleware permission |
| [`app/migrations/`](../app/migrations) | Migrasi SQL + runner (`migrate.js`) |
| [`app/telegram_bot.js`](../app/telegram_bot.js) | Bot Telegram (notifikasi) |
| [`app/whatsapp_bot.js`](../app/whatsapp_bot.js) | Bot WhatsApp via Baileys |
| [`app/youtube_stream.js`](../app/youtube_stream.js) | Kelola FFmpeg untuk YouTube live |
| [`app/onvif_discovery.js`](../app/onvif_discovery.js) | Auto-discover kamera ONVIF di jaringan |
| `app/install.sh`, `install_ubuntu.sh` | Installer bare-metal (Ubuntu/Debian/Pi) |
| `app/*.sh`, `*.bat` | Skrip transcode, deploy, notify (Linux + Windows) |

Catatan kualitas kode: banyak file backup di repo (`*.BACKUP*`, `*.bak`, `services/*.1`).
Ini artefak pengembangan, bukan bagian runtime — sudah dikecualikan di `.dockerignore`.

## 4. Fitur utama (dari README)

- Dashboard grid live multi-kamera (HLS auto-play, status online/offline).
- Rekaman otomatis 24/7 + auto-cleanup 3 lapis (umur file, disk penuh, orphan DB).
- YouTube livestream 1-klik dengan auto-deteksi codec (copy H.264 / transcode H.265).
- Notifikasi Telegram & WhatsApp (kamera offline, disk penuh).
- Web Push (PWA, `vapid-keys.json`, `subscriptions.json`).
- ONVIF discovery + kontrol PTZ.
- Billing/paket berlangganan + bukti transfer (`transactions`, `bukti_tf/`).
- Activity log (audit trail) + sistem alert berbasis rule.
- Fitur AI opsional (deteksi objek via TensorFlow.js + coco-ssd) — tabel `ai_*`.
- Multi-level akses (umum / member / vip / admin) via `services/levelPermissions.js`.

## 5. Port yang dipakai

| Port | Layanan | Sumber |
|------|---------|--------|
| 3003 | Web dashboard (Express) | `config.server.port` |
| 8555 | RTSP (input kamera) | `mediamtx.yml` / `config.mediamtx.rtsp_port` |
| 8856 | HLS (playback browser) | `mediamtx.yml` / `config.mediamtx.hls_port` |
| 9123 | MediaMTX API (kontrol) | `mediamtx.yml` / `config.mediamtx.api_port` |
| 1936 | RTMP (ingest) | `mediamtx.yml` |
| 8890/udp | WebRTC | `mediamtx.yml` |
| 8050/8051 udp | RTP/RTCP | `mediamtx.yml` |

## 6. State yang harus persist

Agar container bisa dibangun ulang tanpa kehilangan data, yang **wajib** disimpan di volume:

- `cameras.db` (+ `-wal`, `-shm`) — seluruh data aplikasi.
- `config.json` — konfigurasi (juga diubah dari UI saat runtime).
- `recordings/` — file rekaman video (dibagi dengan container MediaMTX).
- `baileys_auth_info/` — sesi login WhatsApp (kalau bot dipakai).
- `subscriptions.json`, `vapid-keys.json` — Web Push.
- `uploads/`, `bukti_tf/` — unggahan & bukti transfer billing.
