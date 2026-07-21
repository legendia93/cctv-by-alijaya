# Tech Stack

Ringkasan teknologi yang dipakai aplikasi CCTV Monitoring, dari
[`app/package.json`](../app/package.json) dan analisa kode.

---

## Runtime & bahasa

| Komponen | Versi | Catatan |
|----------|-------|---------|
| **Node.js** | v20.x | Disyaratkan README; base image Docker `node:20-bookworm-slim` |
| **JavaScript (CommonJS)** | — | `"type": "commonjs"` |

## Framework & library inti

| Library | Versi | Fungsi |
|---------|-------|--------|
| **express** | ^5.2.1 | Web framework (route API + render view) |
| **ejs** | ^4.0.1 | Template engine (front-end SSR) |
| **express-session** | ^1.19.0 | Sesi login admin |
| **body-parser** | ^2.2.2 | Parsing request body |
| **cors** | ^2.8.6 | CORS |
| **sqlite3** | ^5.1.7 | Database embedded (lihat [analisa DB](03-database-analysis.md)) |
| **bcrypt** | ^6.0.0 | Hash password |

## Streaming & media

| Komponen | Versi | Fungsi |
|----------|-------|--------|
| **MediaMTX** | 1.16.1 | Server streaming RTSP→HLS/WebRTC/RTMP + rekaman (proses/container terpisah) |
| **ffmpeg-static** | ^5.3.0 | Binary FFmpeg (fallback ke ffmpeg sistem) untuk transcode & YouTube live |
| **onvif** | ^0.7.4 | Discovery & kontrol kamera ONVIF/PTZ |
| **hls.js** | (di `public/js`) | Pemutar HLS di browser |

## Notifikasi & bot

| Library | Versi | Fungsi |
|---------|-------|--------|
| **@whiskeysockets/baileys** | ^7.0.0-rc10 | Bot WhatsApp (butuh sesi auth persist) |
| **node-telegram-bot-api** | ^0.67.0 | Bot Telegram |
| **web-push** | ^3.6.7 | Notifikasi Web Push (PWA) |
| **qrcode / qrcode-terminal** | ^1.5.4 / ^0.12.0 | QR untuk pairing WhatsApp |

## AI (opsional)

| Library | Versi | Fungsi |
|---------|-------|--------|
| **@tensorflow/tfjs** | ^4.17.0 | Runtime TensorFlow.js |
| **@tensorflow-models/coco-ssd** | ^2.2.3 | Deteksi objek (orang/kendaraan) |

## Lain-lain

| Library | Versi | Fungsi |
|---------|-------|--------|
| **pino** | ^10.3.1 | Logging terstruktur |

## Front-end (disajikan dari server)

- **EJS** untuk template ([`app/views`](../app/views)).
- CSS: Tailwind (build statis), `modern.css`, Leaflet CSS.
- JS browser: `hls.js` (playback), `leaflet.js` (peta lokasi kamera), `password-toggle.js`.
- **PWA**: `manifest.json` + `sw.js` (service worker) + ikon berbagai ukuran.

## Sistem operasi target

- **Bare-metal:** Ubuntu 20.04+ / Debian 11+ / Raspberry Pi OS / Armbian (ARMv7/v8, x86_64).
- **Docker:** image berbasis Debian bookworm (`node:20-bookworm-slim`) — lintas arsitektur
  selama base image & MediaMTX tersedia untuk arsitektur tersebut (amd64 & arm64 tersedia).

## Ringkasan diagram

```
┌───────────────────────────── Node.js 20 (Express monolith) ─────────────────────────────┐
│  Route API (JSON)   ·   Render EJS (front-end)   ·   Session/Auth (bcrypt)               │
│  Bot: WhatsApp(Baileys) · Telegram · WebPush     ·   YouTube live (FFmpeg)               │
│  ONVIF discovery/PTZ    ·   AI opsional (tfjs + coco-ssd)                                 │
│                              │  SQL (sqlite3)                                             │
│                              ▼                                                            │
│                         cameras.db (SQLite, WAL)                                          │
└──────────────────────────────┬───────────────────────────────────────────────────────────┘
                               │  REST API :9123 / HLS :8856
                               ▼
                          MediaMTX 1.16.1  ── RTSP :8555 ◄── IP Cameras
                               │
                               ▼  tulis
                          ./recordings (fmp4)
```
