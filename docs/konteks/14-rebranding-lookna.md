# Rebranding: cctv-allinone → **lookna**

Diputuskan & dikerjakan 2026-07-21. Nama container/image/branding diganti dari
`cctv-allinone` menjadi **`lookna`**.

## Kenapa "lookna"

Berangkat dari ide user: bahasa Jawa **ndelok / delok** = melihat. Dieksplorasi juga
Sanskerta/Jawa Kuno (`netra`, `waskita`, `darsana`, `sanjaya`).

**Kandidat yang dicoret & alasannya — jangan diusulkan lagi:**
- `caksu` (Sanskerta *cakṣu* = mata) — **ditolak user: terbaca seperti akronim "cak asu"**.
  Pelajaran: setiap kandidat nama wajib diuji plesetan lokal dulu.
- `paningal` / `tingal` (Jawa Kuno = penglihatan) — terlalu dekat dengan
  "peninggal(an)" / "tinggal" (konotasi mati/ditinggalkan). Buruk untuk sistem
  yang harus selalu hidup.
- `cctv-stream`, `cctv-core` — terlalu generik; susah dikenali di `docker ps` server
  yang penuh container lain (aksflow, panata, flowpos…).
- `dlook` — ide awal user, bagus maknanya tapi `dl` di awal menyendat & ambigu ejaannya.

**`lookna`** dipilih: hybrid "look" + rasa Nusantara, mudah diucap lintas daerah,
tidak ada plesetan, unik di `docker ps`.

## Apa saja yang berubah

| Sebelum | Sesudah |
|---|---|
| `Dockerfile.allinone` | **`Dockerfile.lookna`** (`git mv`, riwayat terjaga) |
| `docker-compose.allinone.yml` | **`docker-compose.lookna.yml`** (`git mv`) |
| `container_name: cctv-allinone` | **`container_name: lookna`** (dev + prod) |
| `image: cctv-allinone` | **`image: lookna`** |
| `localhost:5000/cctv-allinone:v1.0.1` | **`localhost:5000/lookna:v1.1.0`** |
| `site.title: "CCTV ONLINE"` (template) | **`"lookna"`** di `config.docker.json` |

File yang disentuh: `Dockerfile.lookna`, `docker-compose.lookna.yml`,
`docker-compose.prod.yml`, `docker-compose.dev.yml`, `config.docker.json`,
`scripts/deploy.sh`, `scripts/bootstrap-prod.sh`.

`deploy.sh` sekarang memakai variabel `IMAGE_NAME="lookna"` — kalau suatu saat ganti
nama lagi, cukup ubah satu baris itu.

## ⚠️ Pengaman migrasi di deploy.sh — JANGAN DIHAPUS

Karena `container_name` berubah, `docker compose up` **tidak** akan mengganti container
lama. Compose akan membuat container BARU (`lookna`) dan **membiarkan `cctv-allinone`
tetap hidup**. Akibatnya:
- port 3003/8555/8856 bentrok, dan
- **dua proses menulis ke `cameras.db` yang sama → DB bisa rusak.**

Karena itu ditambahkan blok migrasi di `scripts/deploy.sh` (langkah [4/5]) yang
`stop` + `rm` container lama bila masih ada, sebelum `compose up`:

```bash
OLD_CONTAINER="cctv-allinone"
if [ "$(docker ps -aq -f name='^cctv-allinone$')" ]; then
  docker stop cctv-allinone; docker rm cctv-allinone
fi
```

Aman untuk data: yang dihapus hanya **container**, sedangkan `./data` (config, DB,
auth WA) dan `/mnt/cctv-data/recordings` adalah bind mount di host — tidak tersentuh.

Blok ini idempoten (aman dijalankan berulang) dan boleh dihapus setelah beberapa
deploy sukses, kalau sudah yakin tak ada server yang memakai nama lama.

## ⚠️ site.title di PROD tidak ikut berubah otomatis

`config.docker.json` hanyalah **template**. Nilai yang benar-benar dipakai ada di
`data/config.json`, yang **tidak di-commit** dan punya salinan sendiri di prod
(`/opt/cctv/data/config.json`, sekarang berisi `"CCTV SEKAINET"`).

Jadi mengganti template **tidak mengubah tampilan prod**. Untuk mengubahnya, pilih:
1. Lewat UI admin (menu pengaturan situs) — paling aman, tak perlu restart manual, atau
2. Edit `/opt/cctv/data/config.json` di server lalu `docker restart lookna`.

> Pertimbangkan dulu: `site.title` = **nama produk yang dilihat pelanggan**. Mengganti
> "CCTV SEKAINET" → "lookna" mengubah judul di dashboard, preview WhatsApp, dan
> notifikasi. Nama container (teknis) dan nama produk (marketing) boleh saja berbeda.

## Status

- ✅ Semua file diubah, kedua compose lolos `docker compose config`.
- ✅ Build ulang dengan nama baru sukses: `lookna:test` = **1.2 GB**.
- ⏸️ **Belum di-deploy ke prod** — user yang menjalankan `scripts/deploy.sh v1.1.0`.

Terkait: [12-analisa-ukuran-image.md](12-analisa-ukuran-image.md) (perampingan 2.39 → 1.2 GB),
[11-deploy-produksi.md](11-deploy-produksi.md) (alur deploy).
