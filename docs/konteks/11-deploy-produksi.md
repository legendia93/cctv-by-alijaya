# Konteks — Deploy ke Server Produksi (sesi 2026-07-21)

Cara men-deploy CCTV ke server produksi. Pola mengikuti project AksFlow
(`E:\Project\aksflow\scripts\deploy-server.sh`): **build di laptop → push ke registry
privat → ssh → recreate container**. Server tidak pernah build.

---

## 1. Topologi (PENTING — sering salah paham)

```
┌─ TrueNAS 10.10.17.4 (mesin fisik) ──────────────────────────┐
│                                                              │
│   Dataset SSN/VMs/cctv-data   quota 100 GiB  ──NFS──┐        │
│                                                      │        │
│   ┌─ VM Debian 10.10.17.6 ────────────────────────┐  │        │
│   │   registry privat :5000                        │  │        │
│   │   /opt/cctv          ← app + config + DB       │  │        │
│   │   /mnt/cctv-data     ← mount NFS ◄─────────────┼──┘        │
│   │   network: ssn_gateway (bersama AksFlow)       │           │
│   └────────────────────────────────────────────────┘           │
└──────────────────────────────────────────────────────────────┘
```

**`10.10.17.6` adalah VM DI DALAM TrueNAS `10.10.17.4`** — bukan dua mesin terpisah.
Karena satu mesin, trafik NFS tidak keluar host (latensi lokal).

**Kenapa bukan TrueNAS Containers?** Fiturnya masih **Experimental**, pool belum dipilih,
dan yang paling menentukan: **tidak bisa `docker build`** (hanya pull dari registry).
VM Docker sudah punya registry + pola deploy teruji.

## 2. Storage rekaman

| | |
|---|---|
| Dataset | `SSN/VMs/cctv-data`, **quota 100 GiB** (applies to descendants) |
| NFS share | path `/mnt/SSN/VMs/cctv-data` |
| Mount di VM | `/mnt/cctv-data` (permanen via `/etc/fstab`, opsi `_netdev`) |
| `storage_path` | `/app/recordings` → bind ke `/mnt/cctv-data/recordings` |

Entry fstab di VM:
```
10.10.17.4:/mnt/SSN/VMs/cctv-data  /mnt/cctv-data  nfs  defaults,_netdev  0  0
```

### Kenapa quota ZFS, bukan `max_storage_percent` aplikasi
Slider `max_storage_percent` di menu Jadwal Rekaman **mengukur persentase SELURUH disk**,
bukan porsi CCTV. Di pool 898 GiB yang sudah 63% terpakai VM lain, rekaman CCTV 100 GB
hanya ~11% — dan kode di `app/index.js` (`cleanupRecordingsByDiskUsage`) justru **menolak
menghapus** bila porsi rekaman < 5% disk, karena tahu biang keroknya bukan rekaman.
Jadi slider itu tak bisa dipakai sebagai pembatas kuota. **Quota ZFS memberi batas keras
yang benar.** Lihat [[storage-metrics-source]] dan
[06-temuan-lapangan.md](06-temuan-lapangan.md).

Dua lapis tetap dibutuhkan:
- **Quota ZFS 100 GiB** — batas keras, CCTV tak bisa memakan jatah VM lain.
- **Retensi aplikasi** (`delete_after`) — hapus rekaman lama agar tak pernah menyentuh
  quota. Saat quota penuh, tulisan **gagal** (ffmpeg error), bukan auto-hapus.

Perkiraan: 5 kamera @ ~50 MB/jam (preset Ultra Compact) → 100 GB habis ~14 hari.
Retensi **7 hari** (~42 GB) memberi ruang aman.

### Jebakan saat setup NFS (yang benar-benar terjadi)
1. **`mount program didn't pass remote address`** → paket `nfs-common` belum terpasang
   di VM. `apt install -y nfs-common`.
2. **`access denied by server`** → field **Hosts** diisi `10.10.17.6` tapi tetap ditolak.
   Penyebab: interface VM ber-netmask **`/32`** (`inet 10.10.17.6/32`). Solusi: kosongkan
   Hosts, atau pakai field **Networks** dengan `10.10.17.0/24`.
3. **Read-only walau ter-mount** → NFS *root squash*. Set **Maproot User/Group = `root`**
   di Advanced Options share.

## 3. File yang terlibat

| File | Peran |
|------|-------|
| `docker-compose.prod.yml` | Compose produksi — `image:` dari registry (BUKAN `build:`), rekaman ke `/mnt/cctv-data`, network `ssn_gateway` external |
| `scripts/bootstrap-prod.sh` | **Sekali saja** — siapkan `/opt/cctv`, file DB, config.json |
| `scripts/deploy.sh` | **Rutin** — build → push → kirim compose → recreate |
| `app/version.js` | Versi app, diisi otomatis `deploy.sh`; tampil di sidebar admin & halaman live |

## 4. Cara pakai

```bash
# Pertama kali saja
./scripts/bootstrap-prod.sh
# lalu set password admin di /opt/cctv/data/config.json

# Setiap deploy berikutnya — CUKUP INI
./scripts/deploy.sh v1.0.1
```

**Bootstrap tidak perlu diulang.** Deploy hanya mengganti image; `/opt/cctv/data`
(config, DB, uploads) tidak disentuh.

Setelah deploy pertama, generate VAPID keys sekali (perintahnya dicetak bootstrap):
```bash
ssh root@10.10.17.6 "docker exec cctv-allinone node -e \"const w=require('web-push');console.log(JSON.stringify(w.generateVAPIDKeys(),null,2))\" > /opt/cctv/data/vapid-keys.json && docker restart cctv-allinone"
```

## 5. Yang dilakukan `deploy.sh`

```
[0/5] tulis app/version.js  ← semver tanpa "v"
[1/5] sed tag di docker-compose.prod.yml (lokal)
[2/5] docker build -f Dockerfile.allinone
[3/5] docker push 10.10.17.6:5000/cctv-allinone:vX
[4/5] scp compose → ssh → pull → up -d --no-deps --force-recreate
[5/5] verifikasi: status container + df storage + 15 baris log
```

**Compose lokal = sumber kebenaran.** Sejak sesi ini `deploy.sh` **ikut mengirim
`docker-compose.yml`** tiap deploy (beda dengan AksFlow yang manual). Konsekuensi:
penyesuaian yang dibuat langsung di server **akan tertimpa** — ubah di
`docker-compose.prod.yml` lokal, jangan di server.

### Pengaman yang dipasang (tidak ada di AksFlow)
- **Deploy dibatalkan bila `/mnt/cctv-data` tidak ter-mount.** Tanpa ini ffmpeg menulis ke
  folder kosong di dalam container dan rekaman hilang saat recreate berikutnya.
- **Deploy dibatalkan bila network `ssn_gateway` tidak ada.**
- Bootstrap **tidak menimpa `config.json`** yang sudah ada (berisi password & secret).

## 6. Hal yang mudah bikin rusak

- **File SQLite harus di-`touch` dulu.** Compose bind-mount `cameras.db`, `-wal`, `-shm`
  **sebagai file**. Kalau belum ada di server, Docker membuatnya sebagai **DIREKTORI** dan
  SQLite mati total. `bootstrap-prod.sh` sudah menanganinya.
- **Network `ssn_gateway` wajib `external: true`.** Kalau tidak, compose membuat network
  baru bernama `cctv_ssn_gateway` dan container terpisah dari AksFlow. Ini pernah terjadi:
  network di-join manual, lalu hilang saat `--force-recreate` karena belum tercatat di
  compose.
- **`mediamtx.host` harus `127.0.0.1`** di config server (all-in-one, bukan service
  terpisah). Template `config.docker.json` isinya `"mediamtx"` — bootstrap sudah mengubahnya.
- **Registry perlu `insecure-registries`** di Docker laptop, kalau tidak push HTTP ditolak.

## 7. Registry vs `docker images`

Setelah deploy, image ada di **dua tempat di VM yang sama**:

| | Lokasi | Isi |
|---|---|---|
| **Volume registry** | volume container `registry:2` | Gudang semua tag yang pernah di-push — sumber **rollback** |
| **`docker images`** | `/var/lib/docker/` | Salinan hasil `pull`, inilah yang dijalankan container |

Image CCTV ~2.4 GB (ffmpeg + MediaMTX). Versi berikutnya jauh lebih hemat karena layer
dasar dipakai bersama — hanya layer kode yang baru (~50–100 MB).

Kalau perlu bersih-bersih: hapus **`docker images` lama dulu**, jangan registry — registry
satu-satunya tempat rollback tanpa build ulang. Registry tidak punya auto-cleanup;
menghapus tag saja tak membebaskan disk, perlu `registry garbage-collect` dan
`REGISTRY_STORAGE_DELETE_ENABLED=true`.

Di laptop, yang paling boros justru **build cache** — `docker builder prune -a` (aman,
hanya memperlambat build berikutnya).

## 8. Belum diverifikasi

- `bootstrap-prod.sh` & `deploy.sh` **belum pernah dijalankan end-to-end** — ditulis
  berdasarkan pola AksFlow yang sudah terbukti, tapi jalur CCTV-nya masih perlu uji nyata.
- Preview live (HLS) belum diuji di browser setelah deploy.
- Field **Hosts** di NFS share masih dikosongkan (lihat jebakan #2). Jaringan `10.10.17.x`
  internal, tapi idealnya diisi `10.10.17.0/24` lewat field Networks.
