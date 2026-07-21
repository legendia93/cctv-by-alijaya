# Perbaikan Membership (C1, C2, C3)

Implementasi perbaikan atas celah yang ditemukan di
[audit membership](06-audit-membership.md). Semua perubahan ada di
[`app/`](../app) dan sudah lolos `node --check`.

File baru: [`app/utils/membership.js`](../app/utils/membership.js) — sumber tunggal
logika level & expiry.

---

## C1 — Proteksi stream HLS ✅ (kritis)

**Sebelum:** proxy `/cam_*` mem-forward ke MediaMTX tanpa cek apa pun — stream bisa
ditonton siapa saja tanpa login.

**Sesudah** ([`index.js`](../app/index.js), blok "HLS authorization gate"):

- Proxy dipisah jadi fungsi `proxyHlsToMediaMtx(req, res)`.
- Ditambah **middleware otorisasi** sebelum proxy:
  - Admin (`req.session.user`) → selalu boleh.
  - Selain itu, ekstrak `camId` dari path `/cam_<id>/...`, lookup `level` + `owner_id`
    kamera (dengan cache 15 dtk agar tidak query tiap segmen), lalu panggil
    `canPlayCamera(ctx, cam)` dengan **effective level** (expiry-aware).
  - Tidak berhak → **HTTP 403** ("Silakan berlangganan").
  - Path `cam_X_input` (non-numerik) → 403 (hanya admin).

**Efek:** gating level kini **nyata di level stream**, bukan sekadar sembunyikan tile.
Membership berbayar tidak bisa dibypass lewat URL langsung.

> Catatan: cache otorisasi 15 detik berarti perubahan level/owner kamera berlaku
> maksimal 15 detik kemudian untuk stream yang sedang jalan. Bisa diatur di konstanta
> `HLS_AUTH_TTL`.

---

## C2 — Enforcement expiry ✅ (kritis)

Konsep inti: **"effective level"** — level yang benar-benar berlaku sekarang. Kalau
`active_until` sudah lewat, level turun otomatis ke `umum`. Logika di
[`membership.js`](../app/utils/membership.js): `getEffectiveLevel(user)` + `isActive()`.

Diterapkan di 3 titik:

1. **Saat login** ([`POST /user/login`](../app/index.js)): session menyimpan
   `level` (effective), `stored_level` (level berbayar asli), dan `active_until`.
2. **Saat gating** (`/`, `/archive`, dan 2 endpoint lain): effective level
   **dihitung ulang tiap request** dari `stored_level` + `active_until`, sehingga
   membership yang habis di tengah sesi langsung ter-enforce (tidak menunggu logout).
3. **Scheduler** `expireMembershipsJob()` tiap 6 jam (+ sekali saat start): meng-UPDATE
   kolom `level` → `umum` untuk yang `active_until` sudah lampau. Ini menjaga data admin
   tetap akurat dan memudahkan pengingat perpanjangan. (Gating tidak bergantung pada job
   ini — sudah expiry-aware di request time — job ini untuk konsistensi data.)

**Efek:** berhenti bayar = akses turun otomatis. Kebocoran pendapatan tertutup.

---

## C3 — Isolasi kepemilikan (`owner_id`) 🟡 (opsional, tergantung model)

**Keputusan produk dulu:**

- **Model "kamera kawasan komunal"** (pelanggan bayar untuk nonton kamera area/jalan
  bersama): **tidak perlu C3**. Biarkan default (`vvip` saja yang owner-scoped).
- **Model "SaaS, tiap pelanggan kamera sendiri"** (kamu jual cloud untuk IP cam milik
  pelanggan): **aktifkan C3** agar pelanggan A tidak melihat kamera pelanggan B.

**Cara aktifkan** (tanpa ubah kode) — set environment variable:

```
CCTV_OWNER_SCOPED_LEVELS=vvip,vip,member
```

Artinya: kamera level `vip`/`member`/`vvip` hanya bisa diputar oleh pemiliknya
(`owner_id = customerId`). Level `umum` tetap komunal (tanpa owner scope).

Di Docker, tambahkan di `docker-compose.yml` service `app`:

```yaml
    environment:
      - TZ=Asia/Jakarta
      - NODE_ENV=production
      - CCTV_OWNER_SCOPED_LEVELS=vvip,vip,member   # aktifkan model per-pelanggan
```

Karena proteksi stream (C1) sudah memakai `canPlayCamera` yang menghormati daftar ini,
mengaktifkan env langsung membuat **playback** ter-isolasi per pemilik. (Tile di UI
mungkin masih tampil untuk level tsb, tapi stream-nya 403 bila bukan pemilik. Kalau mau
tile ikut disembunyikan, query owner-scope di route `/` perlu diperluas — belum
dilakukan agar model komunal default tak berubah.)

**Prasyarat data:** pastikan tiap kamera pelanggan di-set `owner_id`-nya ke id user
pelanggan saat ditambahkan (field sudah ada di form kamera).

---

## Yang BELUM dikerjakan (peningkatan lanjutan)

- **Payment gateway otomatis** (Midtrans/Xendit) — saat ini transfer manual + approve.
- **Kuota storage per pelanggan** — retensi rekaman masih global.
- **Record per kamera** (paket live-only vs live+rekam) — kolom `enable_recording` ada
  tapi belum dipakai untuk kontrol MediaMTX (lihat
  [analisa arsitektur](01-analisa-arsitektur.md)).

---

## Ringkasan file yang diubah

| File | Perubahan |
|------|-----------|
| [`app/utils/membership.js`](../app/utils/membership.js) | **BARU** — `getEffectiveLevel`, `isActive`, `canPlayCamera`, `playableLevelsFor`, `OWNER_SCOPED_LEVELS` (via env) |
| [`app/index.js`](../app/index.js) | Import membership util; login simpan effective level + active_until; gate `/`,`/archive`,dll expiry-aware; **HLS proxy diberi otorisasi** (C1); scheduler `expireMembershipsJob` (C2) |

## Uji cepat (manual, di dev)

1. Buat paket `member` durasi 30 hari, daftar pelanggan, beli, approve → `active_until`
   ke depan. Login pelanggan → kamera `member` bisa diputar.
2. Set `active_until` pelanggan ke tanggal lampau (via `/admin/customers` atau SQL) →
   login ulang → kamera `member` **tidak** bisa diputar (tile mungkin tampil, stream 403).
3. Akses langsung `http://host:3003/cam_<id_member>/index.m3u8` tanpa login → **403**
   (sebelumnya: bisa diputar).
