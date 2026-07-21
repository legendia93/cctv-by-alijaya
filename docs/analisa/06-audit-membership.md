# Audit Sistem Membership

Audit menyeluruh alur membership/langganan di [`app/index.js`](../app/index.js),
untuk menilai kesiapan model bisnis **"jual akses cloud CCTV ke pelanggan WiFi"**.

Tanggal audit: 2026-07-19. Basis kode: repo `alijayanet/cctv-monitoring` v2.1.0.

---

## 1. Ringkasan eksekutif

Fondasi membership **sudah ada dan cukup lengkap** (registrasi, paket, beli, approve,
level akses). **Tetapi ada 3 celah kritis** yang membuatnya **belum aman untuk dijual**
apa adanya:

| # | Celah | Dampak | Tingkat |
|---|-------|--------|---------|
| C1 | **Stream HLS tidak dilindungi** | Siapa pun dgn URL `/cam_X/index.m3u8` bisa nonton tanpa login/bayar | 🔴 Kritis |
| C2 | **Expiry tidak di-enforce** | Membership kadaluarsa tetap bisa akses (level tak turun otomatis) | 🔴 Kritis |
| C3 | **Isolasi `owner_id` hanya untuk VVIP** | Model "kamera milik tiap pelanggan" belum terisolasi untuk level lain | 🟡 Penting |

Perbaikan ketiganya dijelaskan di [dokumen implementasi](07-membership-fixes.md).

---

## 2. Yang SUDAH berfungsi ✅

| Fitur | Endpoint / Lokasi | Catatan |
|-------|-------------------|---------|
| Registrasi pelanggan | `POST /user/register` ([1682](../app/index.js#L1682)) | Auto-login, level awal `umum`, notif WA ke admin & pelanggan |
| Login pelanggan | `POST /user/login` ([1750](../app/index.js#L1750)) | Session `req.session.customer`, terpisah dari admin (`req.session.user`) |
| Paket langganan | tabel `billing_packages`, `/admin/billing` | name, level, price, duration_days |
| Rekening bank | tabel `bank_accounts` | untuk transfer manual |
| Beli paket + bukti transfer | `POST /api/billing/buy` ([2419](../app/index.js#L2419)) | Simpan bukti ke `bukti_tf/`, cegah dobel-pending 24 jam |
| Approve pembayaran | `POST /admin/finance/approve` ([3168](../app/index.js#L3168)) | Set `active_until` + naikkan `level`; perpanjangan menumpuk dari expiry lama |
| Tolak pembayaran | `POST /admin/finance/reject` ([3197](../app/index.js#L3197)) | Simpan alasan |
| Level berjenjang | `/` ([1248](../app/index.js#L1248)) | umum < member < vip < vvip / pemerintahan < admin |
| Manajemen pelanggan | `/admin/customers` ([2018](../app/index.js#L2018)) | List + edit + set `active_until` manual |

**Alur happy-path yang jalan:**
```
register → login → pilih paket → transfer → upload bukti → admin approve
  → active_until = now + duration_days, level naik → tile kamera level-nya muncul di "/"
```

---

## 3. Celah kritis (detail)

### C1 — Stream HLS tidak dilindungi 🔴

**Lokasi:** proxy HLS di [`index.js:440`](../app/index.js#L440).

```js
app.use((req, res, next) => {
    if (req.method !== 'GET' || !req.url.match(/^\/cam_[^\/]+\//)) return next();
    // ... langsung proxy ke MediaMTX, TANPA cek login / level / kepemilikan
});
```

**Masalah:** gating level di `/` hanya menyembunyikan/menandai *tile* di UI
(`isPlayable`). Stream sesungguhnya (`/cam_5/index.m3u8` + segmen) **dapat diakses
siapa saja tanpa autentikasi**. Pelanggan (atau non-pelanggan) yang tahu/menebak nama
path bisa menonton kamera berbayar gratis, bahkan tanpa login.

**Konsekuensi bisnis:** membership berbayar praktis tidak berarti — konten bisa dibypass.

**Perlu:** middleware otorisasi pada proxy `cam_` yang mengecek apakah requester berhak
atas kamera tersebut (berdasar level kamera + level/aktif pelanggan + kepemilikan).

### C2 — Expiry tidak di-enforce 🔴

**Tiga sub-masalah:**

1. **Login tidak cek `active_until`** ([`1802`](../app/index.js#L1802)):
   ```js
   req.session.customer = { id, username, level: user.level, full_name };
   ```
   Level diambil apa adanya dari kolom `level`, tanpa membandingkan `active_until`
   dengan waktu sekarang.

2. **Gating `/` dan `/archive` tidak cek `active_until`** ([1249](../app/index.js#L1249),
   [1343](../app/index.js#L1343)) — hanya membaca `session.customer.level`.

3. **Tidak ada scheduler** yang menurunkan level saat expiry lewat. Daftar `setInterval`
   ([5682–5691](../app/index.js#L5682)) hanya recording/health/cleanup/cuaca. Kolom
   `level` tetap `member` selamanya walau `active_until` sudah lampau.

**Konsekuensi:** pelanggan yang berhenti bayar tetap menikmati akses berbayar tanpa
batas. Pendapatan bocor.

**Perlu:**
- Fungsi `effectiveLevel(user)` = kalau `active_until` < sekarang → turun ke `umum`.
- Terapkan saat login **dan** saat gating (jangan percaya level session yang "beku").
- (Opsional) scheduler harian yang menormalkan kolom `level` → `umum` untuk yang expired,
  agar data konsisten & untuk notifikasi perpanjangan.

### C3 — Isolasi kepemilikan hanya untuk VVIP 🟡

**Lokasi:** query `/` ([1291](../app/index.js#L1291)):
```js
query = `... WHERE LOWER(level) IN (${levels}) AND (LOWER(level) != 'vvip' OR owner_id = ?)`;
```

Filter `owner_id` **hanya** diterapkan pada kamera level `vvip`. Untuk model bisnis
**"tiap pelanggan punya IP cam sendiri di cloud"**, tiap pelanggan seharusnya hanya
melihat kamera **miliknya** (`owner_id = customerId`) di semua level pribadi, bukan cuma
vvip.

**Konsekuensi:** kalau dijadikan SaaS multi-pelanggan (masing-masing kamera sendiri),
pelanggan A bisa melihat kamera pelanggan B selama levelnya sama.

**Perlu:** untuk kamera "pribadi" (mis. level `member`/`vip` yang dimiliki pelanggan),
tambahkan filter `owner_id`. Untuk kamera "kawasan publik/komunal" (mis. `umum`),
tetap tanpa `owner_id`. Perlu keputusan produk: mana kamera komunal vs pribadi.

---

## 4. Catatan tambahan

- **Pembayaran manual** (transfer + upload bukti + approve manual). Belum ada payment
  gateway otomatis (Midtrans/Xendit). Untuk skala RT/RW WiFi umumnya cukup; untuk skala
  besar pertimbangkan integrasi otomatis.
- **Kuota storage per pelanggan belum ada.** Retensi rekaman bersifat **global**
  (`config.recording.delete_after`). Kalau menjual paket beda-durasi-simpan, perlu logika
  retensi per pemilik/kamera.
- **Recording on/off global** (bukan per kamera) — lihat catatan di
  [analisa arsitektur](01-analisa-arsitektur.md). Untuk paket "live-only vs live+rekam"
  perlu record per kamera (`enable_recording` sudah ada kolomnya tapi belum dipakai untuk
  kontrol MediaMTX).

---

## 5. Rekomendasi prioritas

1. **C1 + C2 dulu** (wajib sebelum jual) — tanpa ini, akses berbayar bisa dibypass &
   expiry tak berlaku. Ini yang dikerjakan di [07-membership-fixes.md](07-membership-fixes.md).
2. **C3** — kalau modelnya "kamera pribadi tiap pelanggan". Kalau modelnya "akses ke
   kamera kawasan komunal", C3 tidak mendesak.
3. Payment gateway & kuota storage — peningkatan lanjutan sesuai skala.
