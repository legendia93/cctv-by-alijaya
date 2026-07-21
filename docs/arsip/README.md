# Arsip

File di sini **tidak dipakai** oleh setup aktif — disimpan sebagai referensi saja.

Setup aktif = **all-in-one (1 container)**: `Dockerfile.allinone` +
`docker-compose.allinone.yml` (+ `docker-compose.dev.yml`) + `mediamtx.single.yml`.

## Isi

| File | Asal | Kenapa diarsip |
|------|------|----------------|
| `Dockerfile` | arsitektur 2-container lama | digantikan `Dockerfile.allinone` |
| `docker-compose.yml` | 2 service (app + mediamtx terpisah) | digantikan `docker-compose.allinone.yml` |
| `mediamtx.docker.yml` | config MediaMTX untuk container terpisah | digantikan `mediamtx.single.yml` |
| `repo.txt` | URL repo asli | sudah ada di `README.md` (https://github.com/alijayanet/cctv-monitoring.git) |

Detail keputusan 1-container vs 2-container: [../analisa/08-docker-arsitektur.md](../analisa/08-docker-arsitektur.md).
