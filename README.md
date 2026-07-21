# CCTV Monitoring — Docker Edition

Versi ter-dockerisasi dari sistem monitoring CCTV
[`alijayanet/cctv-monitoring`](https://github.com/alijayanet/cctv-monitoring).
Aplikasi web (Node.js + Express + EJS) untuk menonton, merekam, dan mengelola IP camera
lewat MediaMTX (RTSP → HLS), dengan notifikasi WhatsApp/Telegram, YouTube live, dan billing.

## Struktur folder

```
cctv/
├── app/                        # Aplikasi monolith (hasil clone repo asli, utuh)
│                               #   backend Express + front-end web (EJS/public) jadi satu
├── docs/                       # Dokumentasi (+ docs/arsip: file lama, referensi saja)
├── Dockerfile.allinone         # Image 1-container: Node + MediaMTX + ffmpeg
├── docker-compose.allinone.yml # Setup aktif (produksi)
├── docker-compose.dev.yml      # Overlay DEV (nodemon auto-reload)
├── mediamtx.single.yml         # Config MediaMTX untuk mode 1-container
├── .dockerignore
├── config.docker.json          # Template config Docker (mediamtx.host -> "127.0.0.1")
└── README.md
```

> Catatan: aplikasi ini **monolith** — front-end web-nya di-render langsung oleh server
> (EJS + aset statis di `app/public`), jadi tidak ada folder front-end/back-end terpisah.
> Seluruh kode aplikasi ada di `app/`.

## Mulai cepat (Docker — all-in-one, 1 container)

Arsitektur: **1 container** (Node + MediaMTX + ffmpeg), teruji menangani kamera H.264 &
H.265. Kenapa 1 container: [docs/08-docker-arsitektur.md](docs/08-docker-arsitektur.md).

Dari folder ini (`cctv/`):

```bash
# 1) Siapkan data + config
mkdir -p data/recordings data/uploads data/bukti_tf data/baileys_auth_info
cp config.docker.json data/config.json     # edit: password, session_secret, mediamtx.host=127.0.0.1
cp app/cameras.db data/cameras.db 2>/dev/null || : > data/cameras.db
: > data/cameras.db-wal ; : > data/cameras.db-shm
echo "[]" > data/subscriptions.json

# 2) Build image, lalu generate VAPID keys (JANGAN file 0 byte -> app crash)
docker compose -f docker-compose.allinone.yml build
docker run --rm -v "$PWD/data:/out" cctv-allinone \
  sh -c 'node -e "const wp=require(\"web-push\");process.stdout.write(JSON.stringify(wp.generateVAPIDKeys(),null,2))" > /out/vapid-keys.json'

# 3) Jalankan (produksi)
docker compose -f docker-compose.allinone.yml up -d

# 4) Buka dashboard -> http://localhost:3003  (login dari data/config.json)
```

### Mode DEV (auto-reload, tanpa rebuild tiap ubah kode)

```bash
docker compose -f docker-compose.allinone.yml -f docker-compose.dev.yml up -d
```
Edit `.js/.ejs/.json` di `app/` → nodemon reload otomatis (~1 dtk). Rebuild hanya perlu
saat ubah `package.json`/`Dockerfile`.

Detail lengkap + backup + troubleshooting: **[docs/05-docker.md](docs/05-docker.md)**.

## Dokumentasi

| Dokumen | Isi |
|---------|-----|
| [docs/01-analisa-arsitektur.md](docs/01-analisa-arsitektur.md) | Arsitektur, alur streaming, struktur kode, port, state |
| [docs/02-tech-stack.md](docs/02-tech-stack.md) | Daftar teknologi & library |
| [docs/03-database-analysis.md](docs/03-database-analysis.md) | Analisa engine DB & rekomendasi (SQLite vs Postgres) |
| [docs/04-install-setup-asli.md](docs/04-install-setup-asli.md) | Cara install/setup versi asli (bare-metal) dari repo |
| [docs/05-docker.md](docs/05-docker.md) | Menjalankan & mengelola versi Docker |
| [docs/06-audit-membership.md](docs/06-audit-membership.md) | Audit sistem membership (celah C1/C2/C3) |
| [docs/07-membership-fixes.md](docs/07-membership-fixes.md) | Perbaikan membership: proteksi stream, enforcement expiry, owner scope |
| [docs/08-docker-arsitektur.md](docs/08-docker-arsitektur.md) | Keputusan arsitektur Docker: 1 container vs 2 container |

## Ringkasan teknologi

Node.js 20 · Express 5 · EJS · SQLite · MediaMTX 1.16.1 · FFmpeg · Baileys (WhatsApp) ·
Telegram Bot · Web Push · ONVIF · TensorFlow.js (AI opsional). Lihat
[tech stack](docs/02-tech-stack.md).

## Lisensi

Aplikasi asli berlisensi MIT (lihat [app/LICENSE](app/LICENSE)).
