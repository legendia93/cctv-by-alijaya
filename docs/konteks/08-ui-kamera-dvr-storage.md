# Konteks — Poles UI Kamera/DVR + Perbaikan Storage & Rekaman (SELESAI, sesi 2026-07-21)

Lanjutan dari [07-tema-nothing-os.md](07-tema-nothing-os.md). Sesi ini **tidak** mengubah bahasa
visual — hanya menerapkannya ke halaman yang belum tersentuh, menata ulang layout, dan
memperbaiki **3 bug nyata** (2 di antaranya baru ketahuan saat verifikasi).

Prinsip tema tetap: monokrom + aksen merah hemat, token `--n-*`, utility `.n-*`.

---

## 1. Latar dot-grid diperluas ke seluruh app

Latar titik-titik yang dulu hanya di halaman auth kini dipakai di seluruh app.

| Kelas | Mask | Dipakai di |
|-------|------|-----------|
| `.n-authbg` | radial dari **tengah** | `login` / `user-login` / `register` (kartu terpusat) |
| `.n-appbg` | radial dari **atas** (`120% 90% at 50% 0%`) | shell admin, live wall, arsip, akun pelanggan |

Keduanya kini **terpusat di `nothing.css` §13** (dulu didefinisikan ulang identik di 3 file
auth). Konten shell diberi `position:relative; z-index:1` agar berada di atas latar.

> `user_account.ejs` sebelumnya **tidak** include `head_theme` sama sekali (masih
> slate/emerald penuh). Sekarang sudah include → dapat token + compat + light/dark.
> Belum dirombak per-komponen ke `.n-card`/`.n-num`; via compat sudah netral.

---

## 2. Angka `.n-num` → mono (BUKAN dot-matrix lagi)

**Masalah:** glyph Pixelify Sans membuat `5` nyaris identik dengan `8`, juga `0`/`6`/`9`.
Merenggangkan `letter-spacing` dicoba dulu — **tidak cukup**, karena akar masalahnya bentuk
glyph, bukan jarak.

**Keputusan:** `.n-num` dipindah ke `var(--font-mono)` (Space Mono), `font-weight:700`,
`tabular-nums`. Kelas `.n-num-dot` ditambahkan sebagai opt-in bila suatu saat sengaja mau
efek pixel. Dot-matrix **tetap dipakai** untuk hero/judul (`.n-heading`) — di sana teksnya
kata, bukan angka ambigu.

---

## 3. Halaman Daftar Kamera

- **Judul dipindah keluar card** jadi judul halaman (pola halaman DVR). Baris dalam card
  kini hanya: tombol · filter · search (search didorong `md:ml-auto`).
- Badge **`LIVE`** → **turquois** via token baru `--n-live` (`#0FA3A3` light / `#2DD4D4`
  dark) + kelas `.n-pill-live`. ⚠️ Ini **satu-satunya warna non-monokrom/non-merah** di
  tema — permintaan eksplisit user, bukan default tema.
- Kolom **STATUS**: dot statis → **badge beranimasi** (pola sama `REC`):
  `● ONLINE` (pill ink solid, dot berkedip) / `● OFFLINE` (pill merah) / `● CEK` (awal).
  Utility baru: `.n-dot-pulse-on` + aturan `.n-pill-solid .n-dot-pulse-on` (dot ikut warna
  bg agar terlihat di atas pill solid).
- Panel kanan (ONVIF Scan + Generator URL RTSP) di-compact & on-theme: `.n-card p-4`,
  `.n-input`, tombol cyan/ungu → `.n-btn`/`.n-btn-accent`.

### Modal "Tambah Massal (Bulk)" — DIPINDAH ke sini

Dulu form bulk menempel di bawah halaman DVR/APK (harus scroll jauh). Sekarang jadi
**modal** di Daftar Kamera, tombolnya bersebelahan dengan "Tambah Kamera".

Alasan pemilihan lokasi: bulk adalah aksi *menambah kamera* dan hasilnya muncul di sini.
Argumen "harus di DVR karena butuh template merek" tidak mengikat — form bulk punya
dropdown merek sendiri dari `/api/dvr/brand-templates`, jadi berdiri sendiri.

Penyesuaian saat pindah: daftar merek dimuat **saat modal pertama dibuka** (bukan
page-load, + retry bila gagal), dan setelah sukses halaman **reload** agar kamera baru
langsung tampil. 81 baris HTML + 141 baris JS dihapus bersih dari `admin_dvr_apk.ejs`.

---

## 4. Halaman DVR/APK — dari wizard jadi 2 panel

**Sebelum:** wizard 3 langkah (step indicator → pilih merek → tombol "Lanjutkan" →
konfigurasi), panel saling hide/show.

**Sesudah:** layout 2 panel `lg:grid-cols-[300px_1fr]`, keduanya **selalu tampil**:

```
[ Info & Panduan — full width, collapsible ]   ← 1fr · 1.6fr · 0.9fr
[ Pilih Merek (300px) | Konfigurasi Kamera  ]
```

- Klik merek di kiri → `goToStep2()` dipanggil otomatis → form kanan langsung terisi.
  Step indicator + tombol "Lanjutkan" dibuang; `goToStep2`/`backToStep1` tak lagi
  hide/show panel. `#continueStep1` disisakan sebagai stub tersembunyi.
- Kartu merek dikompakkan lewat CSS scoped `#brandGrid` (ikon gradient warna →
  kotak ink monokrom), 2 kolom + scroll, panel kiri `sticky`.
- **Baris info** (Informasi Merek · Tips · Protokol) dipindah **keluar** `#step2-content`
  jadi baris full-width di atas kedua panel — agar Konfigurasi sejajar dengan Pilih Merek,
  tidak tergeser turun. Proporsi `1fr_1.6fr_0.9fr`: Tips paling lebar (tiap butir muat
  1 baris), Protokol paling sempit.
- **Baris info bisa collapse, DEFAULT TERTUTUP.** Preferensi disimpan di
  `localStorage['cctv_dvr_info_open']`. Terbuka **otomatis sekali** saat merek pertama
  dipilih (agar template URL & tips merek yang baru ter-render tak terlewat), lalu bebas
  ditutup lagi (`infoAutoOpened`).

> ⚠️ Jebakan: `hidden` & `grid` sama-sama mengatur `display` → harus ditukar
> **berpasangan** di `setInfoRow()`. Melepas `hidden` saja tak membentuk grid 3 kolom.

> ⚠️ Jebakan: CSS compact di-scope ke `#step2-content`. Saat baris info dipindah keluar,
> ia kehilangan token (ikon Tips kembali kuning). Solusi: beri `id="info-row"` dan
> perluas selector.

`admin.ejs` sengaja **tidak** disentuh — view usang, tak pernah di-route
(`render('admin')` nol hasil).

---

## 5. Bug yang diperbaiki

### 5a. Checkbox "Rekam ke storage" tak tersimpan saat OFF
Checkbox tak tercentang **tidak dikirim** oleh `FormData`. Server (`index.js` ~3608)
membaca `req.body.enable_recording` → `undefined` → jatuh ke default `: 1` → rekaman
**dipaksa nyala** padahal user mematikannya.

**Fix (client-side, logika server tak diubah):** sebelum submit, set eksplisit
`formData.set('enable_recording', checked ? '1' : '0')`. Berlaku untuk edit **dan** tambah.

### 5b. Kredensial ter-autofill Chrome
Field user/pass (deteksi stream, ONVIF, generator RTSP, config DVR, bulk) terisi sendiri
oleh password manager. Bukan bug kode — perilaku browser.
**Fix:** `autocomplete="off"` / `"new-password"` + `name` non-kredensial, plus
dikosongkan eksplisit saat form edit dibuka.

### 5c. Urutan kamera acak
Query kamera **tak punya `ORDER BY`** → SQLite mengembalikan baris dalam urutan tak tentu.
**Fix:** `ORDER BY nama COLLATE NOCASE ASC` di query live wall & arsip
(`index.js`). Butuh **restart container** (perubahan backend).

Sekalian dibersihkan di `public_recordings.ejs`: literal `#10b981`/`#0f172a` dan warna
level yang di-inject render (`text-emerald/blue/purple`) — luput dari compat layer karena
bukan kelas Tailwind statis.

---

## 6. Storage: dashboard vs menu Storage berbeda angka

**Gejala:** dashboard `25.1 / 1006.9 GB (3%)`, menu Storage `130.5 / 223.57 GB (58%)`.

**Sebab:** keduanya pakai `df` tapi menanyakan lokasi berbeda.

| | Dashboard | Menu Storage |
|---|---|---|
| Sumber | `df /` → disk container (`overlay`) | `df /app/recordings` → drive **E:\** |
| Nilai | 1006.9 GB / 3% | 223.6 GB / 58% |

`/app/recordings` adalah **bind-mount ke drive E:\**, jadi disk container tak ada
hubungannya dengan kapasitas rekaman. Dashboard "aman 3%" padahal drive rekaman 58%.

**Fix:** blok Linux di `index.js` (~948) kini `df` pada `config.recording.storage_path`,
`summary` diambil dari baris pertama. Blok Windows + `recordingUsageCache` juga disamakan
agar menghormati `storage_path` (bukan menebak `__dirname/recordings`).

### ⚠️ Efek samping yang terjadi — dan cacat desain yang terungkap

Begitu dashboard membaca disk yang benar (58%), auto-cleanup (`max_storage_percent: 50`)
**langsung terpicu dan menghapus seluruh 62 file rekaman**. Ini tak diantisipasi sebelum
restart.

Yang terungkap: `cleanupRecordingsByDiskUsage()` mengukur **persentase seluruh disk** tapi
hanya bisa menghapus **file rekaman**. Terbukti — setelah semua rekaman terhapus, disk
**tetap 58%**, karena 129 GB itu **instalasi Docker sendiri** di E:\, bukan rekaman.
Artinya cleanup akan menghabiskan rekaman tanpa pernah mencapai target.

**Pengaman ditambahkan** (`index.js` ~5090): bila porsi disk yang benar-benar dipakai
rekaman **< 5%**, cleanup **SKIP** + log peringatan. Terverifikasi jalan:

```
[Storage Cleanup] SKIP: disk 58% > limit 50%, tapi rekaman hanya 0.00% dari disk.
Ruang dipakai data LAIN — menghapus rekaman tidak menolong.
```

`max_storage_percent` sengaja **dibiarkan 50** (keputusan user — ini mesin dev).

---

## 7. Bukan bug (sempat dikira bug)

- **"Rec off tapi arsip masih terisi"** — file yang terlihat adalah file **lama**. Daftar
  arsip hanya menampilkan **jam tanpa tanggal**, mudah disalahartikan sebagai hari ini.
  Kedua jalur off (toggle tabel & form edit) sudah benar memanggil `updateMediaMtxRecording()`.
- **"Retensi 1 hari tapi file lama masih ada"** — saat dicek, file tertua baru **23 jam**
  (batas 24 jam). `delete_after: "1d"` dikonversi benar ke `24h` oleh
  `normalizeMediaMtxDuration()` (Go tak mengenal unit `d`).

> **Cara verifikasi sebelum vonis bug:** cek `enable_recording` di **`/app/cameras.db`**
> (BUKAN `cctv.db`/`database.db` — keduanya tak punya tabel `cameras`), lalu bandingkan
> mtime `/app/recordings/cam_*/` dengan waktu sekarang.

> ⚠️ Perlu diawasi: `recordDeleteAfter` adalah fitur MediaMTX yang bekerja saat path aktif
> dikelola. Bila **semua** kamera rec-off, file lama berpotensi **tidak** terhapus otomatis
> meski lewat batas.

---

## 8. Service worker — kenapa perubahan CSS tak muncul

**Gejala:** latar dot-grid hanya muncul setelah `Ctrl+R`; pindah halaman → hilang lagi.

**Sebab:** `public/sw.js` meng-cache CSS dengan strategi **Cache First** → `nothing.css`
selalu dari cache lama. Hard-reload mem-bypass SW, navigasi biasa tidak.
**Bukan** masalah server — restart container tak menolong.

**Fix:** CSS & JS → **Network First** (cache hanya fallback offline), gambar tetap Cache
First. Versi cache dinaikkan `v4 → v5` agar SW lama + cache basi terhapus saat aktivasi.

> Tiap ubah `sw.js` untuk perubahan besar, **naikkan versinya** (v5→v6) supaya klien lama
> ikut ter-refresh. User perlu **satu kali** hard-reload agar SW baru mengambil alih.

---

## 9. Yang perlu diketahui sesi berikutnya

- **Restart container** hanya untuk perubahan `app/*.js` (backend). View/CSS/asset cukup
  refresh browser. Lihat [02-dev-workflow.md](02-dev-workflow.md).
- `--n-live` (turquois) adalah **pengecualian** dari aturan monokrom. Jangan jadikan
  preseden untuk menambah warna lain — tokennya sudah rapi bila mau dicabut.
- Sisa pekerjaan opsional (belum diminta): `user_account.ejs` dirombak penuh ke `.n-card`/
  `.n-num`; sisa string `bg-emerald-*` di halaman manajemen (aman, sudah dinetralkan
  compat); tombol/badge dekoratif emerald di `public_recordings.ejs`.
