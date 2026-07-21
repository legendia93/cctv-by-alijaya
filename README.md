# CCTV Monitoring — Docker Edition

Versi ter-dockerisasi dari sistem monitoring CCTV
[`alijayanet/cctv-monitoring`](https://github.com/alijayanet/cctv-monitoring).
Aplikasi web (Node.js + Express + EJS) untuk menonton, merekam, dan mengelola IP camera
lewat MediaMTX (RTSP → HLS), dengan notifikasi WhatsApp/Telegram, YouTube live, dan billing.

Berjalan sebagai **satu container** berisi Node + MediaMTX + ffmpeg. Teruji menangani
kamera H.264 & H.265 (H.265 di-transcode otomatis ke H.264 untuk pemutaran di browser).

---

## Kebutuhan

| | Minimal | Catatan |
|---|---|---|
| Docker Engine | 20.10+ | dengan plugin `docker compose` v2 |
| RAM | 2 GB | 4 GB bila banyak kamera H.265 (transcode makan CPU/RAM) |
| Disk | 10 GB + | rekaman menumpuk cepat; sediakan sesuai retensi |
| OS | Linux / Windows (Docker Desktop) / macOS | |

Cek dulu:

```bash
docker --version && docker compose version
```

---

## Instalasi

### 1. Clone

```bash
git clone https://github.com/legendia93/cctv-by-alijaya.git
cd cctv-by-alijaya
```

### 2. Siapkan folder & file state

> **Wajib dijalankan sebelum `up`.** Compose mem-bind sebagian volume **per-file**
> (`config.json`, `cameras.db`, `vapid-keys.json`, …). Kalau file-nya belum ada, Docker
> akan membuatkannya sebagai **direktori** dan aplikasi gagal start.

```bash
mkdir -p data/recordings data/uploads data/bukti_tf data/baileys_auth_info

cp config.docker.json data/config.json

# DB kosong + sidecar WAL/SHM (SQLite mode WAL)
cp app/cameras.db data/cameras.db 2>/dev/null || : > data/cameras.db
: > data/cameras.db-wal
: > data/cameras.db-shm

echo "[]" > data/subscriptions.json
```

### 3. Edit `data/config.json` — WAJIB

Minimal tiga hal ini:

```jsonc
{
  "server": {
    "session_secret": "<isi hasil perintah di bawah>"
  },
  "authentication": {
    "username": "admin",
    "password": "<password kuat, min 16 karakter>"
  },
  "mediamtx": {
    "host": "127.0.0.1"     // ⚠️ template berisi "mediamtx" — HARUS diganti
  }
}
```

Generate `session_secret`:

```bash
docker run --rm node:20-alpine node -e \
  "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> ⚠️ **`mediamtx.host` harus `127.0.0.1`.** Nilai bawaan template (`"mediamtx"`) adalah
> warisan setup 2-container. Di mode 1-container, Node dan MediaMTX berbagi network yang
> sama — kalau tidak diganti, aplikasi tidak bisa bicara ke MediaMTX dan semua stream mati.

### 4. Build image

```bash
docker compose -f docker-compose.allinone.yml build
```

Butuh beberapa menit (mengunduh Node, MediaMTX, ffmpeg).

### 5. Generate VAPID keys (push notification)

```bash
docker run --rm -v "$PWD/data:/out" cctv-allinone \
  sh -c 'node -e "const wp=require(\"web-push\");process.stdout.write(JSON.stringify(wp.generateVAPIDKeys(),null,2))" > /out/vapid-keys.json'
```

> ⚠️ Jangan biarkan `vapid-keys.json` kosong (0 byte) — aplikasi **crash saat start**.
> Verifikasi: `cat data/vapid-keys.json` harus memuat `publicKey` & `privateKey`.

### 6. Jalankan

```bash
docker compose -f docker-compose.allinone.yml up -d
```

Buka **http://localhost:3003** dan login memakai kredensial dari `data/config.json`.

Cek kesehatan:

```bash
docker compose -f docker-compose.allinone.yml ps      # status harus healthy
docker logs -f cctv-allinone                          # pantau log
```

---

## Menambahkan kamera pertama

1. Login → menu **Daftar Kamera** → **Tambah Kamera**.
2. Isi nama, lokasi, dan URL RTSP, contoh:
   `rtsp://admin:password@192.168.1.100:554/Streaming/Channels/101`
3. Simpan. Tunggu 10–20 detik (MediaMTX perlu menarik stream dan transcode bila H.265).

**Tidak tahu URL RTSP kamera?** Buka menu **DVR/NVR**:
- **Pilih Merek** → form konfigurasi terisi otomatis dengan template URL merek tersebut
  (Hikvision, Dahua, TP-Link Tapo, Reolink, Uniview, dll).
- **Tambah Massal** (di Daftar Kamera) → satu DVR/NVR, banyak channel sekaligus.
- **Cari Kamera (ONVIF Scan)** → pindai kamera di jaringan lokal.

---

## Mode DEV (auto-reload)

Untuk mengembangkan tanpa rebuild tiap ubah kode:

```bash
docker compose -f docker-compose.allinone.yml -f docker-compose.dev.yml up -d
```

Edit `.js` / `.ejs` / `.css` di `app/` → nodemon reload otomatis (~1 detik).

| Yang diubah | Perlu apa |
|---|---|
| `.ejs`, `.css`, aset statis | cukup **refresh browser** |
| `.js` backend | otomatis reload (mode DEV); di mode produksi → `docker restart cctv-allinone` |
| `package.json`, `Dockerfile` | **rebuild** image |

> Perubahan CSS tidak muncul? Aplikasi ini PWA dengan service worker. Lakukan **satu kali**
> hard-reload (`Ctrl+Shift+R`) agar service worker versi baru mengambil alih.

---

## Port

| Port | Untuk | Wajib dipublish? |
|---|---|---|
| `3003` | Dashboard web | **Ya** |
| `8555` | RTSP | Hanya bila perlu akses RTSP dari luar |
| `8856` | HLS | Hanya bila pemutaran langsung dari luar tanpa lewat app |
| `1936` | RTMP (ingest YouTube Live) | Hanya bila pakai fitur YouTube |
| `8890/udp` | WebRTC | Hanya bila pakai WebRTC |

Tidak butuh streaming dari luar? Komentari baris port selain `3003` di
`docker-compose.allinone.yml` — lebih aman.

---

## Perintah harian

```bash
# Status & log
docker compose -f docker-compose.allinone.yml ps
docker logs -f cctv-allinone

# Restart (perlu setelah ubah .js backend di mode produksi)
docker restart cctv-allinone

# Berhenti / hidupkan lagi
docker compose -f docker-compose.allinone.yml down
docker compose -f docker-compose.allinone.yml up -d

# Rebuild setelah ubah Dockerfile / package.json
docker compose -f docker-compose.allinone.yml up -d --build
```

### Backup

Semua state ada di `data/`. Hentikan container dulu agar SQLite konsisten:

```bash
docker compose -f docker-compose.allinone.yml down
tar czf backup-$(date +%F).tar.gz data/
docker compose -f docker-compose.allinone.yml up -d
```

---

## Troubleshooting

**Container restart terus / langsung exit**
```bash
docker logs cctv-allinone --tail 50
```
Paling sering: `vapid-keys.json` kosong (ulangi langkah 5), atau `data/config.json` bukan
JSON valid.

**Stream hitam / kamera tak online**
- Pastikan URL RTSP benar — uji dari host:
  `ffplay rtsp://user:pass@ip:554/path`
- Cek `mediamtx.host` sudah `127.0.0.1`.
- Kamera H.265 dengan **"H.265+" / Smart Codec aktif** sering gagal didecode (`width=0`,
  `PPS id out of range`). Solusinya di sisi perangkat: set encoding ke **H.264** dan
  matikan H.265+. Ini keterbatasan encoder kamera, bukan bug aplikasi.

**Volume jadi folder, bukan file**

Kalau `up` dijalankan sebelum langkah 2, Docker membuat direktori kosong:
```bash
docker compose -f docker-compose.allinone.yml down
rm -rf data/config.json data/cameras.db data/vapid-keys.json data/subscriptions.json
# ulangi langkah 2, 3, 5
```

**Rekaman tidak jalan** — rekaman aktif hanya bila **ketiganya** terpenuhi:
1. **Master ON** (menu Rekaman → Status Rekaman Master)
2. Waktu sekarang dalam rentang jadwal (`start_time`–`end_time`)
3. Kamera itu sendiri di-set REC (badge `REC`, bukan `LIVE`)

**Disk penuh** — atur `max_storage_percent` & `delete_after` di menu Rekaman.
Catatan: pembersihan otomatis hanya bisa menghapus **file rekaman**; bila disk penuh oleh
data lain, ada pengaman yang menghentikannya agar tidak menghapus rekaman sia-sia.

---

## Untuk produksi

Sebelum dipakai serius:

- [ ] Ganti password admin & `session_secret` (jangan pakai nilai dev)
- [ ] Set `behind_https_proxy: true` + isi `public_base_url` / `public_hls_url`
- [ ] Taruh di belakang Nginx/Caddy/Cloudflare dengan HTTPS
- [ ] Jangan publish port streaming ke internet tanpa perlu
- [ ] Siapkan backup terjadwal untuk `data/`
- [ ] `express-session` memakai MemoryStore (ada peringatan "not for production") —
      pertimbangkan store persisten bila menskala

---

## Struktur folder

```
cctv-by-alijaya/
├── app/                        # Aplikasi monolith (Express + EJS + aset publik)
├── data/                       # State persist — TIDAK di-commit (lihat .gitignore)
├── docs/
│   ├── analisa/                # Analisa awal: arsitektur, tech stack, DB, audit
│   ├── konteks/                # Apa yang nyata dikerjakan & sudah jalan
│   ├── plan/                   # Rencana & backlog
│   └── arsip/                  # Dokumen lama (referensi)
├── docker/entrypoint.sh
├── Dockerfile.allinone
├── docker-compose.allinone.yml # Setup aktif
├── docker-compose.dev.yml      # Overlay DEV (nodemon)
├── mediamtx.single.yml         # Config MediaMTX 1-container
└── config.docker.json          # Template config
```

> Aplikasi ini **monolith** — front-end di-render server (EJS + aset di `app/public`),
> jadi tidak ada folder front-end/back-end terpisah.

---

## Dokumentasi

| Dokumen | Isi |
|---------|-----|
| [docs/analisa/01-analisa-arsitektur.md](docs/analisa/01-analisa-arsitektur.md) | Arsitektur, alur streaming, struktur kode, port, state |
| [docs/analisa/02-tech-stack.md](docs/analisa/02-tech-stack.md) | Daftar teknologi & library |
| [docs/analisa/03-database-analysis.md](docs/analisa/03-database-analysis.md) | Analisa engine DB (SQLite vs Postgres) |
| [docs/analisa/04-install-setup-asli.md](docs/analisa/04-install-setup-asli.md) | Install versi asli (bare-metal) |
| [docs/analisa/05-docker.md](docs/analisa/05-docker.md) | Mengelola versi Docker |
| [docs/analisa/06-audit-membership.md](docs/analisa/06-audit-membership.md) | Audit membership (celah C1/C2/C3) |
| [docs/analisa/07-membership-fixes.md](docs/analisa/07-membership-fixes.md) | Perbaikan membership |
| [docs/analisa/08-docker-arsitektur.md](docs/analisa/08-docker-arsitektur.md) | Kenapa 1 container, bukan 2 |
| [docs/konteks/00-ringkasan.md](docs/konteks/00-ringkasan.md) | **Mulai dari sini** untuk memahami kondisi proyek sekarang |

---

## Ringkasan teknologi

Node.js 20 · Express 5 · EJS · SQLite · MediaMTX 1.16.1 · FFmpeg · Baileys (WhatsApp) ·
Telegram Bot · Web Push · ONVIF · TensorFlow.js (AI opsional).

## Lisensi

Aplikasi asli berlisensi MIT — lihat [app/LICENSE](app/LICENSE).
