# Konteks — Arsitektur Docker

## Keputusan: 1 container (all-in-one)

Deployment memakai **SATU container** berisi: Node app + MediaMTX 1.16.1 + ffmpeg +
script transcode, semua share filesystem `/app`. Ini sesuai desain asli app yang
co-located (bare-metal).

### Kenapa BUKAN 2 container (app + mediamtx terpisah)

Sempat dicoba, gagal karena app mengasumsikan MediaMTX satu mesin dengannya. 4 masalah:
1. API MediaMTX 401 (butuh authInternalUsers).
2. Path rekaman beda antar container.
3. Proxy HLS hardcode `127.0.0.1:8856`.
4. **FATAL: transcode H.265→H.264 tak jalan** — app set `runOnReady: ./smart_transcode.sh`
   yang dieksekusi proses MediaMTX, tapi container `bluenviron/mediamtx` tak punya
   ffmpeg/bash/script. Kamera H.265 tak bisa tampil di browser.

Detail lengkap: `docs/08-docker-arsitektur.md`.

## File Docker (AKTIF, 1 container)

| File | Peran |
|------|-------|
| `Dockerfile.lookna` | Node 20 + ffmpeg + MediaMTX (download binary v1.16.1) + nodemon + script. Strip CRLF `.sh`. Build context = root, source dari `app/`. |
| `docker-compose.lookna.yml` | 1 service `app`. Mount `data/*` + `mediamtx.single.yml` → `/app/mediamtx.yml`. |
| `docker-compose.dev.yml` | Override DEV: bind-mount `./app`→`/app`, `DEV_MODE=1` (nodemon), node_modules pakai anonymous volume. |
| `mediamtx.single.yml` | Config MediaMTX: `authInternalUsers` (any, permissive - internal only), `pathDefaults.recordPath=/app/recordings/...`, port RTSP/HLS/API. |
| `docker/entrypoint.sh` | Jalankan MediaMTX (background) lalu Node (foreground). `DEV_MODE=1` → pakai nodemon. tini sebagai PID 1. |

## File Docker (ARSIP, 2 container — TIDAK dipakai, referensi saja)

`Dockerfile`, `docker-compose.yml`, `mediamtx.docker.yml`, `.dockerignore`.

## Hal penting arsitektur

### Line endings (.sh)
Script `.sh` hasil clone di Windows ber-CRLF → shebang `#!/bin/bash\r` → "not found" →
transcode gagal. Diperbaiki 2 lapis:
- `app/.gitattributes` : `*.sh text eol=lf` (mencegah clone berikutnya CRLF)
- Dockerfile: `sed -i 's/\r$//'` pada semua `/app/*.sh`
- File `.sh` di host **sudah dikonversi ke LF** manual (9 file).

### SQLite WAL
DB pakai WAL. Sidecar `cameras.db-wal` & `cameras.db-shm` **harus** di-mount eksplisit
(di compose), kalau tidak tulisan hilang saat container recreate. Ketiganya harus ada
sebagai file sebelum `up`.

### config.json untuk 1 container
`mediamtx.host` HARUS `127.0.0.1` (bukan `mediamtx`). Sudah di-set di `data/config.json`.
Template `config.docker.json` masih menyebut placeholder — belum diseragamkan (lihat
[../plan/07-backlog.md](../plan/07-backlog.md)).

### Port
3003 web (dipublish). 8555 RTSP, 8856 HLS, 1936 RTMP, 8890/udp WebRTC (opsional publish).
9123 API MediaMTX (TIDAK dipublish, internal).

### ARM (Raspberry/Orange Pi 64-bit)
Build dengan `--build-arg MEDIAMTX_ARCH=arm64v8`.
