# Menjalankan dengan Docker

Versi Docker aplikasi CCTV Monitoring. Arsitektur yang dipakai & **teruji jalan**:
**satu container all-in-one** (Node + MediaMTX + ffmpeg + script transcode), sesuai
desain asli app yang co-located (bare-metal).

> Kenapa 1 container, bukan 2? Lihat [08-docker-arsitektur.md](08-docker-arsitektur.md).
> Ringkas: app menyuruh MediaMTX menjalankan `smart_transcode.sh` (butuh ffmpeg+bash
> satu filesystem), pakai path rekaman `__dirname`, dan sebagian panggilan `127.0.0.1`.
> Memisah ke 2 container membuat transcode H.265→H.264 tak jalan & rekaman salah path.

File terkait (di **root** `E:\Project\cctv\`):

| File | Fungsi |
|------|--------|
| [`Dockerfile.lookna`](../Dockerfile.lookna) | Image: Node 20 + ffmpeg + MediaMTX 1.16.1 + script |
| [`docker-compose.lookna.yml`](../docker-compose.lookna.yml) | 1 service `app` |
| [`docker-compose.dev.yml`](../docker-compose.dev.yml) | Override DEV: live source + nodemon |
| [`mediamtx.single.yml`](../mediamtx.single.yml) | Config MediaMTX (auth + path `/app/recordings`) |
| [`docker/entrypoint.sh`](../docker/entrypoint.sh) | Jalankan MediaMTX (bg) + Node (fg / nodemon) |
| [`config.docker.json`](../config.docker.json) | Template config (host = `127.0.0.1`) |

---

## 1. Arsitektur (1 container)

```
┌──────────────── container: lookna ────────────────┐
│  entrypoint.sh                                            │
│   ├─ MediaMTX 1.16.1  (RTSP :8555, HLS :8856, API :9123)  │
│   │     ├─ pull RTSP kamera  ──► cam_X_input             │
│   │     └─ runOnReady: smart_transcode.sh (ffmpeg)       │
│   │            └─ H.265→H.264 / copy  ──► cam_X          │
│   └─ Node app :3003 (web + API + proxy HLS same-origin)  │
│                                                          │
│  semua share /app  →  127.0.0.1 antar-proses, path benar │
└───────────────────────────┬──────────────────────────────┘
                            │ volume ./data
                     cameras.db · config.json · recordings/
```

Kamera H.264 → **copy** (CPU ~0). Kamera H.265 → **transcode** ke H.264 (pakai CPU) agar
bisa diputar browser. Keduanya sudah diuji jalan di dev.

## 2. Persiapan (sekali)

Dari root repo:

```bash
mkdir -p data/recordings data/uploads data/bukti_tf data/baileys_auth_info
cp config.docker.json data/config.json          # lalu edit (lihat di bawah)
cp app/cameras.db data/cameras.db 2>/dev/null || : > data/cameras.db
: > data/cameras.db-wal ; : > data/cameras.db-shm   # sidecar WAL (WAJIB, lihat catatan)
echo "[]" > data/subscriptions.json

# Build image
docker compose -f docker-compose.lookna.yml build

# Generate VAPID keys (JANGAN file 0 byte -> app crash saat start)
docker run --rm -v "$PWD/data:/out" lookna \
  sh -c 'node -e "const w=require(\"web-push\");process.stdout.write(JSON.stringify(w.generateVAPIDKeys(),null,2))" > /out/vapid-keys.json'
# (Windows Git Bash: ganti $PWD/data -> path absolut, mis. E:/Project/cctv/data)
```

Edit `data/config.json`:
- `authentication.password` → ganti (min 16 char)
- `server.session_secret` → `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `mediamtx.host` → **`127.0.0.1`** (WAJIB untuk 1 container)
- `server.behind_https_proxy` → `false` untuk akses `http://localhost:3003` langsung

> **Catatan WAL (penting):** DB pakai mode WAL. Sidecar `cameras.db-wal` & `cameras.db-shm`
> di-mount eksplisit di compose supaya tulisan tidak hilang saat container di-recreate.
> Karena itu keduanya harus ada sebagai file sebelum `up`.
>
> **Jangan** buat `vapid-keys.json`/`subscriptions.json` sebagai file 0 byte — app
> `JSON.parse` keduanya dan crash. `subscriptions.json` = `[]`, `vapid-keys.json` = generate.

## 3. Jalankan (produksi)

```bash
docker compose -f docker-compose.lookna.yml up -d
docker compose -f docker-compose.lookna.yml logs -f
# buka http://localhost:3003
```

## 4. Jalankan (DEV — tanpa rebuild tiap ubah kode)

```bash
docker compose -f docker-compose.lookna.yml -f docker-compose.dev.yml up -d
```

Mode ini:
- Bind-mount `./app` → `/app` (edit di host langsung terlihat).
- `DEV_MODE=1` → Node dijalankan lewat **nodemon**; ubah `.js/.ejs/.json` auto-reload ~1 dtk.
- MediaMTX tetap jalan saat Node reload (tak putus stream).

Rebuild **hanya** perlu bila ubah `package.json` (dependensi npm baru) atau `Dockerfile`.

> Line endings: script `.sh` dipaksa LF (`app/.gitattributes` + Dockerfile strip CR).
> CRLF (dari clone di Windows) merusak shebang `#!/bin/bash` → transcode gagal.

## 5. Tambah kamera

Admin → **Tambah RTSP** → isi URL RTSP kamera. App otomatis daftarkan ke MediaMTX,
tarik stream, transcode bila H.265, dan tampil di dashboard. Butuh server bisa menjangkau
IP kamera (di dev sudah diverifikasi reachable dari dalam container).

## 6. Port

| Port | Fungsi | Publish? |
|------|--------|----------|
| 3003 | Web dashboard | ya |
| 8555 | RTSP | opsional (akses eksternal) |
| 8856 | HLS | opsional |
| 1936 | RTMP (YouTube ingest) | opsional |
| 8890/udp | WebRTC | opsional |
| 9123 | MediaMTX API | tidak (internal) |

## 7. Operasional

```bash
docker compose -f docker-compose.lookna.yml restart
docker compose -f docker-compose.lookna.yml down          # data di ./data aman
docker compose -f docker-compose.lookna.yml up -d --build  # setelah ubah Dockerfile/deps
tar -czf cctv-data-backup.tar.gz data/                       # backup semua state
```

## 8. Catatan

- **ARM (Raspberry/Orange Pi 64-bit):** build dengan `--build-arg MEDIAMTX_ARCH=arm64v8`.
- **WhatsApp bot:** scan QR di `logs -f` saat pertama; sesi persist di `data/baileys_auth_info`.
- **C3 owner scope:** aktifkan env `CCTV_OWNER_SCOPED_LEVELS` (lihat
  [07-membership-fixes.md](07-membership-fixes.md)).
- Arsip arsitektur 2-container lama: `Dockerfile`, `docker-compose.yml`,
  `mediamtx.docker.yml` (disimpan sebagai referensi, tidak dipakai).
