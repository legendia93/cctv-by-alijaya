# Konteks — Sistem Membership

Tujuan bisnis: jual akses cloud CCTV ke pelanggan WiFi (langganan berbayar + public view).

## Yang sudah ada di app (bawaan)

- Registrasi pelanggan `POST /user/register`, login `POST /user/login` (session
  `req.session.customer`, terpisah dari admin `req.session.user`).
- Paket langganan (`billing_packages`), beli + upload bukti transfer
  (`POST /api/billing/buy` → simpan `bukti_tf/`), approve admin
  (`POST /admin/finance/approve` → set `active_until` + naikkan `level`).
- Level berjenjang: `umum` < `member` < `vip` < `vvip`/`pemerintahan` < `admin`.
- Public dashboard di `/` (tanpa login), filter kamera per level.
- Manajemen pelanggan `/admin/customers`.

## 3 celah yang DITEMUKAN & DIPERBAIKI

Dokumentasi lengkap: `docs/06-audit-membership.md` (audit) + `docs/07-membership-fixes.md`
(perbaikan). Logika di `app/utils/membership.js`.

### C1 — Stream HLS tidak dilindungi 🔴 → SUDAH DIPERBAIKI
Dulu: `/cam_X/index.m3u8` bisa ditonton siapa saja tanpa login (gating cuma kosmetik UI).
Sekarang: proxy HLS punya gate otorisasi — cek level kamera vs effective level pelanggan.
Tak berhak → 403. **Teruji**: anon ke cam member = 403, admin = boleh, active member = boleh,
expired member = 403.

### C2 — Expiry tidak di-enforce 🔴 → SUDAH DIPERBAIKI
Konsep **effective level**: kalau `active_until` lewat → level turun ke `umum`.
Diterapkan saat login + dihitung ulang tiap request (expiry mid-session langsung berlaku)
+ scheduler `expireMembershipsJob()` 6-jaman untuk normalisasi kolom `level`.

### C3 — Isolasi owner_id 🟢 → SEKARANG AKTIF DEFAULT (per-user)
Model bisnis diputuskan: **SaaS per-pelanggan**. Setiap kamera **non-`umum`** bersifat
privat — hanya pemiliknya (`owner_id = customerId`) yang bisa **lihat tile-nya** dan
**memutarnya**. Kamera `umum` tetap komunal (tampil untuk semua, termasuk anonim).

Diterapkan di 2 lapisan (keduanya sudah selaras):
- **Tile** (route `/`, `/archive`, `/api/recordings`): query difilter
  `LOWER(level) = 'umum' OR owner_id = customerId`. Anonim hanya `umum`.
- **Stream/playback** (C1, `canPlayCamera`): default `OWNER_SCOPED_LEVELS` kini
  `['vvip','pemerintahan','vip','member']` (semua level berbayar). Bisa dioverride via
  env `CCTV_OWNER_SCOPED_LEVELS`.

Prasyarat: set `owner_id` tiap kamera pelanggan saat menambah/edit.
Level dropdown UI diciutkan ke **UMUM / MEMBER** (admin dipilih di manajemen user);
vip/vvip/pemerintahan disembunyikan tapi logikanya masih ada (kamera lama tetap jalan).

### Bind kamera ke user (UI) + tampilan dashboard
- **Cara bind**: Admin → Manajemen Kamera → tambah/edit kamera → **Level = MEMBER** →
  muncul field **"Pemilik Kamera (Bind ke User)"** → pilih user → simpan. Kolom **Pemilik**
  di tabel menampilkan pemiliknya (atau "⚠ Belum di-bind" kalau kosong).
- **Dashboard `/`**: user yang punya kamera bind → kameranya **auto-terbuka** di grid +
  section **"Kamera Saya"**; kamera umum **ter-collapse** ("Kamera Umum (N)"). User tanpa
  kamera / anonim → lihat umum normal.
- ⚠️ Kalau level=member tapi `owner_id` kosong → kamera **tak tampil ke siapa pun** (hanya
  admin). Validasi peringatan belum ada (lihat [../plan/07-backlog.md](../plan/07-backlog.md)).

## Cara pakai untuk jualan (SaaS per-pelanggan)

1. Buat paket (mis. `member`, 30 hari, harga X) di `/admin/billing`.
2. Pelanggan daftar → login → beli → upload bukti → admin approve (`active_until` + level naik).
3. Tambah kamera pelanggan: `level=member` + **bind ke user-nya** (owner_id).
4. Kamera kawasan publik/gratis: `level=umum` (komunal, tampil ke semua tanpa login).
5. Pelanggan aktif login → hanya lihat & putar kamera miliknya + umum; expired → turun `umum`.

## Belum ada (peningkatan lanjut)

- Payment gateway otomatis (Midtrans/Xendit) — sekarang manual transfer+approve.
- Kuota storage per pelanggan — retensi rekaman masih global.
- CRUD level akses (tambah/hapus level dari UI) — hierarki masih hardcode di
  `membership.js` + `levelPermissions.js`.
