# Konteks — Tabel Admin, Permission Manager & Preview Live (SELESAI, sesi 2026-07-21)

Lanjutan dari [08-ui-kamera-dvr-storage.md](08-ui-kamera-dvr-storage.md). Sesi ini
merapikan kepadatan UI, menetapkan **pola tabel admin** yang dipakai ulang di 3 halaman,
menambah **preview live**, dan menutup satu **cacat data**: matriks permission yang
hardcode.

Pola visualnya didokumentasikan terpisah sebagai referensi:
[style-table.md](09-style-table.md).

---

## 1. Rapatkan jarak (sidebar, rekaman, kamera)

- **Sidebar** (`partials/admin_sidebar.ejs`): `.nav-link` padding `9px 12px` → `6px 12px`,
  `margin-bottom` 1px → 0, radius 12 → 10; `.section-title` `10px 12px 4px` → `6px 12px 2px`;
  `.sidebar-group` margin-bottom dipaksa 2px (sebelumnya `mb-2` = 8px dari Tailwind).
  Hemat ±7px per item.
- **Daftar Kamera** (`admin_cameras.ejs`): toolbar `flex-wrap` → `flex-nowrap` +
  `overflow-x-auto` supaya muat 1 baris; semua tombol ~`5px 10px`, font 10px; label
  dipendekkan ("Tambah Massal" → **Massal**). Sel tabel `p-4` → `px-3 py-1.5`.
- **Jadwal Rekaman** (`admin_recordings.ejs`): card `p-6`→`p-5`, blok preset `p-6 mb-8`→
  `p-4 mb-5`, `space-y-8`→`space-y-5`, input `px-4 py-3`→`px-3 py-2 text-sm`.
  `hover:scale-[1.005]` dihapus — efek zoom pada panel form mengganggu saat mengisi.

### Badge kecil `.n-pill-xs` (BARU, di `nothing.css`)
```css
.n-pill-xs { font-size: 8px; padding: 2px 7px; gap: 4px; letter-spacing: 0.1em; font-weight: 700; }
.n-pill-xs .n-dot { width: 5px; height: 5px; }
```
Dipakai untuk badge ONLINE/OFFLINE dan LIVE/REC di tabel kamera.

> ⚠️ **Jebakan**: JS polling status menimpa `el.className` di 3 tempat
> (`admin_cameras.ejs`). Setiap penambahan class pada badge **harus ikut ditulis di
> sana**, kalau tidak ukurannya kembali besar setelah status ter-update.

## 2. Preview live kamera (FITUR BARU)

Klik badge status (ONLINE/OFFLINE/CEK) di Daftar Kamera → modal live view.

- **RTSP** → HLS `${hlsBase}/cam_<id>/index.m3u8`, fallback otomatis ke
  `cam_<id>_input/index.m3u8` (pola sama dengan `index.ejs`), lalu native HLS untuk Safari.
- **Embed** → `<iframe>`; URL YouTube (`youtu.be`, `watch?v=`, `live/`) dikonversi ke
  `/embed/` + `autoplay=1&mute=1`.
- `closePreview()` men-`destroy()` instance Hls dan mengosongkan iframe — **wajib**, kalau
  tidak stream tetap jalan di background.
- Tutup via X, klik backdrop, atau **Esc**.

**Tanpa perubahan backend**: `hlsBaseUrl` sudah jadi `res.locals` global
(`utils/middleware.js`) dan `hls.min.js` sudah dimuat di `partials/admin_header.ejs`.

## 3. Permission Manager dirombak jadi tabel

`admin_permissions.ejs` — dari **tab per-level** (klik bergantian untuk membandingkan)
menjadi **satu tabel**: baris = fitur, kolom = level (umum/member/admin).

- Section (Streaming, Data & Informasi, Akun Pengguna, Admin Panel) jadi **baris di dalam
  tabel**, bisa collapse, **default tertutup**. Saat tertutup tetap menampilkan hitungan
  aktif per level (`3/4`), jadi tak perlu dibuka untuk mengintip.
- **Toggle berwarna**: OFF merah `#f43f5e`, ON hijau `#10b981` — track, border, dan knob
  berubah bersamaan. Sebelumnya monokrom (knob putih di track abu), arah on/off cuma bisa
  ditebak dari posisi.
- Aksi cepat ON/OFF menempel pada badge level di baris atas; tombol
  `Buka Semua`/`Tutup Semua` di kanan.
- Toggle hanya menukar class (`classList.toggle('on')`), **tidak** render ulang tabel —
  tak ada kedipan.

> ⚠️ **`disabled` pada `<span>`/`<div>` tidak berefek.** Kode lama memasang `disabled` di
> `<div>` pembungkus dan mengira menu admin terkunci. Sekarang pakai class `.locked`
> (opacity 35%) + guard `isLocked()` di setiap fungsi handler.

> ⚠️ **`gray-850` bukan warna Tailwind.** Card memakai
> `bg-gradient-to-br from-gray-800 via-gray-850 to-gray-900` → gradien rusak, muncul
> semburat kebiruan. Diganti `n-card`.

## 4. Matriks permission sekarang baca DB (CACAT DATA — DIPERBAIKI)

**Masalah**: matriks "Level Akses & Permission Matrix" di `admin_customers.ejs` memakai
array `levels` **hardcode di dalam view** (13 fitur), sedangkan menu Permission membaca
tabel SQLite lewat `services/levelPermissions.js` (29 permission). Dua sumber terpisah —
ubah toggle di menu Permission, matriks tetap menampilkan nilai lama. **Matriks bisa
berbohong.** Saat ditemukan keduanya kebetulan masih sinkron, dijaga manual.

**Perbaikan**: matriks kini `fetch('/api/permissions/all')` — endpoint yang sama dengan
menu Permission. Array hardcode dibuang.

- **Lazy load**: fetch baru jalan saat panel matriks pertama kali dibuka.
- Pengelompokan & label disamakan dengan menu Permission.
- Grup **Admin Panel sengaja tidak ditampilkan** — seluruh menunya khusus admin, barisnya
  selalu ✗ ✗ ✓ (15 baris tanpa informasi). Diberi keterangan di legenda. Ini murni
  penyaringan tampilan; data 29 permission tetap utuh di DB.
- Deskripsi level jadi **tooltip ⓘ** di header kolom, bukan kartu/legenda terpisah.
- Kartu "F3 Fitur Lainnya" yang mengulang isi tabel diganti jadi **Catatan** berisi hal
  yang tabel tak bisa sampaikan (kamera umum = komunal, non-umum = milik owner).

Verifikasi round-trip DB sudah dijalankan (ubah `member.camera_playback` → terbaca
berubah → dipulihkan).

## 5. Daftar Kamera full-width

`admin_cameras.ejs` — grid `xl:grid-cols-3` dihapus. Dua panel kanan (**ONVIF Scan** dan
**Generator URL RTSP**) dipindah jadi **modal**, tombolnya di toolbar kanan bersama kotak
cari: `[Cari kamera…] · ONVIF Scan · Generator URL`.

Form + JS-nya (scan, generate, salin) tidak diubah — hanya wadahnya berpindah.

> Isi modal memakai `background: var(--n-surface)` (solid), **bukan** transparan seperti
> tabel. Modal melayang di atas backdrop gelap; kalau transparan isinya tembus dan tak
> terbaca. Pola transparan hanya untuk tabel di atas kanvas halaman.

## 6. Form pelanggan jadi modal

`admin_customers.ejs` — form "Tambah Pelanggan Baru" yang sebelumnya selalu terbentang di
halaman kini jadi modal, dibuka lewat tombol **+ Tambah Pelanggan** di header daftar
(perilaku sama seperti Tambah Kamera). `editUser()` membuka modal, bukan scroll ke atas.

## 7. Penjelasan Master ON/OFF di Jadwal Rekaman

`admin_recordings.ejs` — ditambah panel penjelasan **3 lapis kontrol rekam** tepat di atas
dropdown Master (sesuai [03-patch-app-clone.md](03-patch-app-clone.md) §Fakta penting):

1. **Master** — sakelar global; OFF = tak ada kamera yang merekam sama sekali.
2. **Jendela waktu** — Waktu Mulai–Selesai; di luar jam itu berhenti walau Master ON.
3. **Toggle per-kamera** (`enable_recording`) — hanya bisa **mematikan**; tak bisa merekam
   di luar dua lapis di atas.

Poin 3 yang paling sering membingungkan, dan relevan dengan kondisi lapangan: kelima
kamera terdaftar `enable_recording=0` (live-only), jadi meski Master ON tak ada yang
tersimpan ke disk.

---

## File yang disentuh

| File | Perubahan |
|------|-----------|
| `app/public/css/nothing.css` | + `.n-pill-xs` (badge kecil) |
| `app/views/partials/admin_sidebar.ejs` | Rapatkan jarak menu |
| `app/views/admin_cameras.ejs` | Toolbar 1 baris, tabel rapat + transparan, **preview live**, full-width, ONVIF & Generator jadi modal |
| `app/views/admin_recordings.ejs` | Rapatkan spacing + panel penjelasan Master ON/OFF |
| `app/views/admin_customers.ejs` | Matriks **baca DB**, form jadi modal, tabel pola baru |
| `app/views/admin_permissions.ejs` | Rombak jadi tabel + toggle berwarna + collapse |
| `docs/konteks/09-style-table.md` | **BARU** — referensi pola tabel admin |

**Nol perubahan logika server.** Semua endpoint (`/api/permissions/*`,
`/admin/users/*`, `/admin/camera/*`) dipakai apa adanya.

## Belum dikerjakan / catatan

- Preview live **belum diuji end-to-end di browser** (HLS sungguhan). Kalau muncul
  "Stream tidak dapat dimuat", cek Console — kemungkinan port HLS atau CORS.
- Simpan permission & simpan pelanggan belum diuji klik sungguhan; round-trip DB-nya
  sudah diverifikasi lewat modul langsung.
- Level `vip`/`vvip`/`pemerintahan` masih ada di `DEFAULT_PERMISSIONS`
  (`services/levelPermissions.js`) tapi tidak tampil di UI mana pun.
