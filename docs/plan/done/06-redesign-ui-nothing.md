# Plan #6 — Redesign UI: Tema "Nothing OS"

Status: ✅ **done** (sesi 2026-07-20) · Kompleksitas: **Tinggi** · Sifat: **presentasi/CSS**, bukan logika

> **Hasil eksekusi** ada di [../../konteks/07-tema-nothing-os.md](../../konteks/07-tema-nothing-os.md).
> Dokumen di bawah ini = rencana asli (dipertahankan untuk jejak historis).

## Tujuan (dari user)

> "Fokus pada UI. Ubah keseluruhan agar feel-nya seperti hasil UI **human**, bukan
> **AI-generated**. Referensi = **Nothing OS theme**, jadikan acuan."

Bukan menambah fitur. Mengganti *bahasa visual* seluruh aplikasi supaya terasa
dirancang manusia (opinionated, konsisten, "engineered") — bukan output template.

---

## 1. Kenapa UI sekarang terasa "AI-generated"

Diagnosis dari kode aktual (`admin_header.ejs`, `login.ejs`, `modern.css`, `index.ejs`):

| Ciri "AI-generated" saat ini | Kenapa terbaca template |
|------------------------------|-------------------------|
| **Aksen emerald** `#10b981` di mana-mana (400+ pakai di 26 file) | Warna default hero tiap generator UI |
| **Gradient** logo & tombol (`from-emerald-500 to-emerald-700`), 17 file | Dekorasi tanpa maksud fungsional |
| **Glassmorphism** (`backdrop-filter: blur` + border putih 5%) | Efek "wow" yang sudah jadi klise |
| **Glow shadow** (`--glow-green: 0 0 15px …`) | Neon depth palsu |
| Dark-navy `#0f172a`/`#0a0c10` + emerald | Kombinasi paling sering di-generate |
| Banyak `shadow-lg shadow-emerald-900/30`, `translateY(-4px)` hover | Micro-interaction generik |
| Semua sudut `rounded-xl` seragam, tanpa hirarki | Tidak ada sistem, hanya default |

Intinya: **dekorasi menggantikan sistem**. Nothing OS = kebalikannya — sistem ketat,
dekorasi ~nol.

---

## 2. Acuan: prinsip Nothing OS (dari 2 gambar referensi user)

1. **Monokrom + satu aksen merah.**
   - Netral: off-white `#F4F4F4`, kartu putih `#FFF`, kartu hitam `#0A0A0A`, abu garis.
   - Aksen: **Nothing Red `#D71921`** — dipakai **sangat hemat** (1–2 elemen/layar:
     status rekam, tombol primer tunggal, dot notifikasi). Merah = "ini penting".
2. **Datar total.** Tanpa gradient warna, tanpa glow, tanpa glass/blur. Kedalaman lewat
   **layout, kontras hitam-putih, dan garis tipis 1px** — bukan shadow. (Shadow halus
   `0 1px 2px rgba(0,0,0,.06)` boleh, sangat tipis.)
3. **Tipografi 2 lini:**
   - **Dot-matrix** ("Ndot"-style) untuk **angka besar, jam, label teknis, badge** →
     kesan "engineered". Fallback: font monospace dotted bila Ndot tak bisa di-bundle.
   - **Grotesk bersih** (Space Grotesk / Inter tight) untuk teks isi.
   - **Label uppercase kecil, letter-spacing lebar, monospace** untuk metadata
     (`● REC`, `CH 01`, `RTSP`, `ONLINE`).
4. **Bentuk bento:** kartu **squircle** (radius besar 20–28px) & **lingkaran penuh** untuk
   tombol/status. Grid rapat, ritme konsisten. Tiap kartu = 1 fungsi jelas.
5. **Ikon monoline** stroke tipis seragam (stroke-width 1.5), tanpa fill warna.
6. **Dua mode:** **Light dominan** (sesuai referensi) + **Dark** ("pure black" `#0A0A0A`,
   bukan navy). Wajib dua-duanya karena app CCTV sering dipantau malam.
7. **Ruang kosong dihormati** — jangan penuhi tiap piksel. White space = fitur.

Anti-pola yang DILARANG di tema baru: emerald, gradient warna, glow, glass/blur,
`translateY` hover bouncy, shadow tebal, sudut seragam tanpa hirarki.

---

## 3. Kondisi teknis terkini (hasil audit kode)

- **Styling**: Tailwind via **CDN** (`cdn.tailwindcss.com`) di 9 file, config di-**inline**
  per file (`tailwind.config = {…}` di `<script>`). Plus `public/css/modern.css` (88 baris,
  variabel emerald + glass) dan `public/css/tailwind.css`.
- **Font**: Plus Jakarta Sans + JetBrains Mono (admin), Inter (public/login).
- **Struktur**: ~26 view EJS, total ~18.6k baris. Shell admin = `partials/admin_header.ejs`
  (head + body open + sidebar) → `admin_sidebar.ejs` → konten → `admin_footer.ejs`.
  Public = `index.ejs` mandiri (punya `:root` var + `[data-theme=light]`).
- **Emerald tersebar**: `admin_customers` 69, `admin_dvr_apk` 65, `admin_apk_cctv` 49,
  `index` 46, dst. Migrasi manual per-utility = mahal & rawan miss.

**Konsekuensi**: pendekatan paling andal = **satu design-token layer terpusat** yang
meng-*override* dari atas, lalu bersihkan hardcode emerald bertahap. Bukan cari-ganti
400+ kelas sekaligus.

---

## 4. Strategi

### Prinsip
- **Sumber kebenaran tunggal**: satu file token + satu Tailwind config bersama, di-include
  semua view. Hentikan config emerald yang di-inline per file.
- **Migrasi bertahap & bisa dites** per halaman — bukan big-bang. Setiap halaman selesai
  bisa direview terpisah.
- **Nol perubahan logika server**. Hanya `.ejs`/CSS/asset → *view cache off*, cukup refresh
  (tak perlu `docker restart`). Lihat [konteks dev-workflow](../../konteks/02-dev-workflow.md).

### Keputusan yang perlu konfirmasi user (lihat §7)
- Font dot-matrix: bundle lokal vs Google Font pengganti.
- Ambil-alih penuh (buang emerald) vs. mode berdampingan sementara.
- Light-first atau tetap dark-first.

---

## 5. Design tokens (target)

Dibuat sebagai `public/css/nothing.css` — CSS variables + utility class kecil,
di-include SEBELUM konten. Draft nilai:

```css
:root {                      /* LIGHT (default, sesuai referensi) */
  --n-bg:        #F4F4F4;    /* off-white kanvas */
  --n-surface:   #FFFFFF;    /* kartu */
  --n-surface-2: #ECECEC;    /* kartu sekunder */
  --n-ink:       #0A0A0A;    /* teks/utama, kartu hitam */
  --n-ink-soft:  #6B6B6B;    /* teks sekunder */
  --n-line:      #E2E2E2;    /* garis 1px */
  --n-accent:    #D71921;    /* MERAH — hemat! */
  --n-radius:    22px;       /* squircle default */
  --n-radius-pill: 999px;
  --n-shadow:    0 1px 2px rgba(0,0,0,.06);   /* super tipis */
  --font-dot:    'Ndot','Space Mono',monospace;
  --font-sans:   'Space Grotesk','Inter',sans-serif;
}
[data-theme="dark"] {        /* PURE BLACK, bukan navy */
  --n-bg:#0A0A0A; --n-surface:#161616; --n-surface-2:#1E1E1E;
  --n-ink:#F4F4F4; --n-ink-soft:#9A9A9A; --n-line:#2A2A2A;
  --n-accent:#FF2A34; --n-shadow:0 1px 2px rgba(0,0,0,.5);
}
```

Tailwind config bersama (satu file `partials/head_theme.ejs`) memetakan token →
`colors.n.*`, `fontFamily.dot/sans`, `borderRadius`, sehingga utility Tailwind ikut tema.

---

## 6. Rencana eksekusi (bertahap, urut)

> Tiap fase kecil, bisa direview & di-rollback sendiri. Refresh browser cukup (view cache off).

**Fase 0 — Fondasi (tanpa ubah tampilan halaman dulu)**
- [ ] Buat `public/css/nothing.css` (tokens + utility: `.n-card`, `.n-btn`, `.n-btn-accent`,
      `.n-pill`, `.n-label`, `.n-dot`, `.n-num` dot-matrix, garis, dsb).
- [ ] Buat `partials/head_theme.ejs`: font (bundle/CDN dot-matrix), Tailwind config bersama,
      link `nothing.css`. Diselipkan ke `<head>`.
- [ ] Sediakan font dot-matrix (tergantung keputusan §7) di `public/fonts/`.

**Fase 1 — Shell admin (dampak terluas dulu)**
- [ ] `partials/admin_header.ejs`: buang config emerald inline + gradient/glass → pakai
      `head_theme`. Body pakai token.
- [ ] `partials/admin_sidebar.ejs`: nav flat, aktif = garis/kotak hitam (bukan glow emerald),
      logo jadi dot-mark monokrom, label uppercase mono.
- [ ] `partials/admin_footer.ejs` + `global_modal.ejs`: modal flat, tombol sistem baru.
- [ ] Toggle **Light/Dark** di header (persist `localStorage`), default Light.

**Fase 2 — Dashboard & halaman inti**
- [ ] `admin_dashboard.ejs`: kartu statistik → **bento** (angka dot-matrix besar, label mono).
- [ ] `admin_cameras.ejs`: tabel/kartu kamera, badge `● REC`/`LIVE` → gaya Nothing
      (REC = satu-satunya merah), modal form flat.
- [ ] `index.ejs` (public live wall): grid video, panel, peta → monokrom; dot merah = live.

**Fase 3 — Auth & akun**
- [ ] `login.ejs`, `user-login.ejs`, `register.ejs`, `user_account.ejs`: kartu tunggal
      terpusat, satu tombol aksen merah, hero dot-matrix.

**Fase 4 — Sisa halaman manajemen** (per file, konsisten pola Fase 2)
- [ ] customers, permissions, billing, finance, storage, recordings, streaming, dvr_apk,
      ptz, activity, alerts, reports, settings, weather, public_recordings.

**Fase 5 — Bersih-bersih**
- [ ] Hapus sisa hardcode `emerald*`, `gradient`, `glass`, `glow` (grep sweep).
- [ ] Pensiunkan/rombak `modern.css` (var emerald+glass) → alias ke token baru.
- [ ] Update `<meta name="theme-color">` & manifest ke palet baru.
- [ ] Cek kontras aksesibilitas (WCAG AA) di light & dark.

---

## 7. Keputusan (SUDAH DIKONFIRMASI user)

1. **Font dot-matrix** → **bundle open-source lokal** di `public/fonts/`. Cari font
   dotted/pixel berlisensi bebas (mis. gaya "Ndot"-alike) → self-host, offline, konsisten.
   Fallback stack: `'Ndot','Space Mono',monospace`. TIDAK pakai Google Font CDN untuk ini.
2. **Cakupan** → **hanya halaman yang muncul di SIDEBAR** (+ shell). Lihat §7a untuk
   daftar pasti. Bukan semua view. Halaman publik "Lihat Live" & "Arsip" **ikut**.
3. **Mode** → **Light default + Dark tersedia**. Light = kondisi awal (sesuai referensi &
   pembeda dari UI dark-emerald lama); toggle simpan preferensi di `localStorage`.

## 7a. Cakupan pasti (terverifikasi dari kode + sidebar)

> **Koreksi angka:** klaim "26 halaman" di draft awal SALAH (itu hitungan file yang memuat
> string "emerald"). Fakta: **29 view root + 4 partial = 33 file**, tapi **hanya 25 view
> yang benar-benar `res.render`** di `index.js`. Sisanya file mati.

**IN — dikerjakan (17 halaman sidebar + shell):**

| Grup sidebar | Item | View |
|---|---|---|
| — (shell) | header/sidebar/footer/modal | `partials/admin_header`, `admin_sidebar`, `admin_footer`, `global_modal` |
| Menu | Dashboard | `admin_dashboard` |
| Menu | Lihat Live (publik `/`) | `index` |
| Menu | Arsip (publik `/archive`) | `public_recordings` |
| Kamera & Media | Daftar Kamera | `admin_cameras` |
| Kamera & Media | DVR/NVR | `admin_dvr_apk` |
| Kamera & Media | PTZ | `admin_ptz` |
| Kamera & Media | YouTube | `admin_streaming` |
| Kamera & Media | Rekaman | `admin_recordings` |
| Kamera & Media | Storage | `admin_storage` |
| Manajemen | Pelanggan | `admin_customers` |
| Manajemen | Permission | `admin_permissions` |
| Manajemen | Billing | `admin_billing` |
| Manajemen | Keuangan | `admin_finance` |
| Log & Notif | Log | `admin_activity` |
| Log & Notif | Alert | `admin_alerts` |
| Log & Notif | Laporan | `admin_reports` |
| Log & Notif | Setting | `admin_settings` |

**OUT — TIDAK dikerjakan sekarang:**
- Disembunyikan dari sidebar (route ada, tapi bukan cakupan): `admin_apk_cctv`, `admin_p2p_stream`.
- Auth/akun (bukan item sidebar): `login`, `user-login`, `register`, `user_account`.
- Lain: `weather`, `admin_alert_history`.
- **File MATI (tak pernah dirender — abaikan total):** `admin.ejs`, `recordings.ejs`,
  `recordings1.ejs`, `recordings_backup.ejs`, `public_recordings_backup.ejs`.

---

## 8. Risiko & catatan

- **Tailwind CDN**: config di-inline per file → selama masih ada file yang belum dimigrasi,
  dua config bisa bentrok. Mitigasi: `head_theme` jadi satu-satunya sumber; file lama
  dibersihkan saat gilirannya.
- **Konsistensi antar 26 file** sulit dijaga manual → makanya utility class terpusat
  (`.n-card`, dll.) dulu, halaman tinggal pakai.
- **Tanpa restart**: semua perubahan view/CSS/asset → refresh saja (view cache off).
  Kalau tambah dependency build (mis. Tailwind lokal via npm) → itu baru butuh rebuild;
  rencana ini **tetap pakai CDN** agar tak perlu.
- **Jangan sentuh logika**: badge REC/LIVE, level membership, dsb. hanya diganti *tampilan*.
