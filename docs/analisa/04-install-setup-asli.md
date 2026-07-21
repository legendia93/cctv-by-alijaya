# Cara Install & Setup (versi asli / bare-metal)

Catatan lengkap cara instalasi & konfigurasi **dari repo asli**, sebelum di-Docker-kan.
Ini rangkuman dari `app/README.md`, `app/install.sh`, dan file konfigurasi.

> Untuk menjalankan versi **Docker**, lihat [05-docker.md](05-docker.md).

---

## 1. Persyaratan sistem (bare-metal)

- **OS:** Ubuntu 20.04+ / Debian 11+ / Raspberry Pi OS / Armbian
- **RAM:** min 1 GB (2 GB+ untuk banyak kamera)
- **Disk:** 500 MB untuk instalasi + storage rekaman
- **CPU:** ARMv7/ARMv8 (Raspberry/Orange Pi) atau x86_64
- **Software:** Node.js v20, FFmpeg, MediaMTX, SQLite3 (semua di-handle installer)

## 2. Instalasi otomatis (cara resmi repo)

```bash
git clone https://github.com/alijayanet/cctv-monitoring.git
cd cctv-monitoring
chmod +x install.sh
sudo bash install.sh
```

`install.sh` (v2.0.0, multi-arsitektur) otomatis:

- Deteksi OS & arsitektur (amd64/arm64/armv7).
- Install **Node.js v20** dari NodeSource.
- Download & konfigurasi **MediaMTX v1.16.1** (sesuai arsitektur).
- Install **FFmpeg**.
- Generate skrip helper (`smart_transcode.sh`, `record_notify.sh`).
- Buat **systemd service**: `cctv-web` (port 3003) & `mediamtx` (auto-restart on boot).
- Setup firewall (port 3003, 8555, 8856, 9123).
- Inisialisasi database (semua tabel dibuat otomatis oleh `database.js`).
- Start semua service.

Setelah selesai:

```
Dashboard : http://<server-ip>:3003
HLS       : http://<server-ip>:8856
Login     : admin / ChangeMe@Secure123456   (WAJIB diganti)
```

## 3. Instalasi manual (ringkas)

```bash
sudo apt update && sudo apt install -y git curl wget ffmpeg sqlite3 build-essential python3
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
git clone https://github.com/alijayanet/cctv-monitoring.git && cd cctv-monitoring
npm install --production
# Download MediaMTX sesuai arsitektur dari:
#   https://github.com/bluenviron/mediamtx/releases  (pakai v1.16.1)
# Jalankan:
./mediamtx ./mediamtx.yml &
npm start
```

## 4. Konfigurasi penting (`config.json`)

**WAJIB diubah sebelum production:**

| Field | Default | Aksi |
|-------|---------|------|
| `authentication.password` | `ChangeMe@Secure123456` | Ganti, min 16 karakter |
| `authentication.username` | `admin` | Sebaiknya diganti |
| `server.session_secret` | string default | Ganti dgn random 32+ char |
| `server.behind_https_proxy` | `true` | `false` bila akses langsung tanpa proxy |
| `server.public_base_url` | `https://stream.alijaya.com` | Sesuaikan domain sendiri |

Generate session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 5. Port

| Port | Layanan |
|------|---------|
| 3003 | Web dashboard |
| 8555 | RTSP (input kamera) |
| 8856 | HLS (playback browser) |
| 9123 | MediaMTX API (kontrol internal) |

## 6. Menambah kamera

**Via RTSP URL** (Admin → Cameras → + Tambah Kamera):

```
Nama      : Front Door
Lokasi    : Gate
Tipe      : RTSP
URL RTSP  : rtsp://admin:password@192.168.1.100:554/stream
Level     : umum / member / vip / admin
```

Format RTSP umum per merek:

| Merek | Format URL | Default login |
|-------|-----------|---------------|
| Hikvision | `rtsp://ip:554/h264/ch1/main` | admin / 12345 |
| Dahua | `rtsp://ip:554/stream1` | admin / admin |
| Uniview | `rtsp://ip:554/stream1` | admin / 123456 |
| TP-Link/Tapo | `rtsp://ip:554/stream1` | admin / admin |
| Reolink | `rtsp://ip:554/h264Preview_01_main` | admin / admin |
| Axis | `rtsp://ip:554/axis-media/media.amp` | root / (kosong) |

**Via ONVIF discovery:** Admin → Cameras → Discover Cameras (otomatis scan jaringan).

## 7. Manajemen service (bare-metal / systemd)

```bash
sudo systemctl status  cctv-web mediamtx
sudo systemctl restart cctv-web          # setelah ubah config.json
sudo journalctl -u cctv-web -f           # lihat log real-time
```

## 8. Remote access

- **Cloudflare Tunnel** atau **Nginx reverse proxy** (contoh config di `app/README.md`).
- Set `behind_https_proxy: true` + `public_base_url` / `public_hls_url` ke domain publik.

## 9. Troubleshooting singkat

| Masalah | Penyebab / solusi |
|---------|-------------------|
| Video hitam | Kamera pakai H.265 → ganti ke H.264, atau aktifkan smart transcode (CPU naik) |
| Rekaman tidak tersimpan | Cek folder `recordings/`, disk penuh, permission, log MediaMTX |
| YouTube gagal | Cek FFmpeg, stream key valid (bukan URL penuh), kamera online |
| CPU tinggi | H.265 transcoding / terlalu banyak kamera → turunkan resolusi/fps/bitrate |
| Storage penuh | Cek `delete_after`, auto-cleanup jalan saat disk > `max_storage_percent` |

## 10. Backup

```bash
cp cameras.db cameras.db.backup       # database
cp config.json config.json.backup     # konfigurasi
tar -czf recordings_backup.tar.gz recordings/
```
