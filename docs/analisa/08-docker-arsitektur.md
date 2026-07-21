# Keputusan Arsitektur Docker: 1 Container vs 2 Container

Catatan kenapa deployment akhirnya memakai **1 container all-in-one**, bukan 2 container
terpisah (app + mediamtx). Ditulis setelah keduanya diuji langsung di dev.

---

## Percobaan awal: 2 container (app + mediamtx)

Pertimbangan awal (praktik umum Docker):
- MediaMTX punya image resmi → tak perlu download binary per-arsitektur.
- Pemisahan concern (streaming vs app), 1 proses per container.

### Kenapa gagal untuk app ini

App **tidak** memperlakukan MediaMTX sebagai layanan terpisah — ia mengasumsikan
**satu mesin/filesystem** dengannya. Terbukti dari 4 masalah beruntun:

| # | Masalah | Sebab |
|---|---------|-------|
| 1 | API MediaMTX 401 | MediaMTX 1.16.x wajib auth; perlu `authInternalUsers` |
| 2 | Rekaman salah path | App kirim `recordPath=/app/recordings` (dari `__dirname`-nya), tapi di container mediamtx mount-nya beda |
| 3 | Playback HLS gagal | Proxy HLS app hardcode `127.0.0.1:8856` → di 2 container bukan localhost |
| 4 | **Transcode H.265→H.264 TAK JALAN** | App set `runOnReady: ./smart_transcode.sh`, dieksekusi oleh **proses MediaMTX** di container `bluenviron/mediamtx` yang **tak punya ffmpeg, bash, maupun script itu** |

Masalah #4 fatal: kamera H.265 (umum di CCTV) tak bisa ditampilkan di browser sama sekali.
Gejalanya: kamera sempat ONLINE lalu OFFLINE lagi, tak stabil.

## Keputusan: 1 container all-in-one

Node + MediaMTX + ffmpeg + script transcode dalam **satu container**, share `/app`.
Persis model bare-metal yang app ini dirancang untuknya.

### Hasil uji (3 kamera dev)

| Kamera | Codec input | Output | Hasil |
|--------|-------------|--------|-------|
| SSN-01 | H.264 | H.264 (copy) | ✅ online, CPU ~0 |
| SSN-02 | H.264 | H.264 (copy) | ✅ online |
| Kedai | **H.265** | **H.264 (transcode)** | ✅ online — transcode jalan |

Semua HLS playback HTTP 200, dan **tetap online setelah restart** (persistence OK).

### Perbandingan

| Aspek | 2 container | 1 container ✅ |
|-------|-------------|----------------|
| Transcode H.265→H.264 | ❌ tak jalan | ✅ natural |
| Path rekaman | ⚠️ manual disamakan | ✅ otomatis benar |
| `127.0.0.1` hardcode | ⚠️ perlu patch | ✅ jalan apa adanya |
| Sesuai desain app | ❌ melawan asumsi | ✅ = bare-metal |
| Kerumitan | tinggi | rendah |
| Update MediaMTX | ganti tag image | ganti `ARG MEDIAMTX_VERSION` + rebuild |

Satu-satunya kelebihan 2-container (update image mudah, isolasi) tak sepadan dengan
kerumitan & kerapuhannya di sini.

## Implikasi & hal yang diperbaiki

- **Line endings**: script `.sh` hasil clone di Windows ber-CRLF → shebang `#!/bin/bash\r`
  → "not found" → transcode gagal. Diperbaiki: `app/.gitattributes` (`*.sh eol=lf`) +
  Dockerfile `sed -i 's/\r$//'`.
- **SQLite WAL**: sidecar `cameras.db-wal`/`-shm` harus ikut di-mount, kalau tidak tulisan
  hilang saat container recreate.
- **Dev mode**: karena source di-mount, nodemon bisa auto-reload tanpa rebuild
  (lihat [05-docker.md](05-docker.md) bagian DEV).

## File

Aktif (1 container): `Dockerfile.lookna`, `docker-compose.lookna.yml`,
`docker-compose.dev.yml`, `mediamtx.single.yml`, `docker/entrypoint.sh`.

Arsip (2 container, referensi saja): `Dockerfile`, `docker-compose.yml`,
`mediamtx.docker.yml`.
