# Konteks — Redesign UI: Tema "Nothing OS" (SELESAI, sesi 2026-07-20)

Plan #6 ([../plan/done/06-redesign-ui-nothing.md](../plan/done/06-redesign-ui-nothing.md))
sudah **dieksekusi**. Doc ini mencatat *apa yang berubah di kode* dan *cara sistemnya
bekerja*, supaya sesi berikutnya tak salah menata ulang.

Tujuan: ganti **bahasa visual** seluruh app dari dark-navy + emerald + glass/gradient
(terasa "AI-generated") ke **Nothing OS**: monokrom + satu aksen merah, datar total,
tipografi dot-matrix, kartu bento, light-default + dark. **Nol perubahan logika server.**

---

## 1. Sumber kebenaran tunggal (file BARU)

| File | Isi |
|------|-----|
| `app/public/css/nothing.css` | **Design token layer.** CSS variables light + `[data-theme="dark"]` (pure-black `#0A0A0A`, bukan navy), aksen merah `#D71921` (dark `#FF2A34`), radius squircle, garis 1px, shadow super-tipis. Plus utility class: `.n-card`, `.n-card-2`, `.n-card-black`, `.n-btn`/`.n-btn-accent`/`.n-btn-ghost`, `.n-pill`/`.n-pill-accent`, `.n-dot`/`.n-dot-live`, `.n-label`, `.n-num` (dot-matrix), `.n-heading`, `.n-input`, `.n-scroll`, `.n-fade-in`. Juga `@font-face` **Ndot** (self-host). |
| `app/views/partials/head_theme.ejs` | **Partial `<head>` bersama.** Berisi: (a) link font Google (Space Grotesk + Space Mono), (b) link `nothing.css`, (c) **Tailwind config bersama** (map token → `colors.n.*`, `fontFamily.dot/sans/mono`, `borderRadius.n*`), (d) **legacy compat layer** (`<style id="n-legacy-compat">`), (e) **init tema** (light default, persist `localStorage['cctv_theme']`) + `window.toggleTheme()`. |
| `app/public/fonts/ndot.ttf` | Font dot-matrix **Pixelify Sans** (lisensi **OFL**, `OFL.txt` disertakan). Di-self-host, offline. Fallback stack: `'Ndot','Space Mono','JetBrains Mono',monospace`. **BUKAN** Google Font CDN (sesuai keputusan plan §7). ~79 KB. |

### Cara tema kerja (penting)
- Semua warna via **CSS variable** `--n-*`. Utility Tailwind (`bg-n-surface`, `text-n-ink`,
  dll.) resolve ke variable itu — jadi **auto-switch light/dark tanpa `dark:` variant**.
- `data-theme` di-set pada `<html>` oleh script init di `head_theme` **sebelum body render**
  (cegah flash). Nilai: `light` (default) atau `dark`, dibaca dari `localStorage['cctv_theme']`.
- Toggle: `window.toggleTheme()` (di sidebar admin + mobile header). Flip atribut +
  persist + update `<meta theme-color>` + dispatch event `themechange`.

### Legacy compat layer — kunci strategi bertahap
`head_theme` memuat `<style>` yang **meng-override kelas Tailwind lama** (`bg-gray-800`,
`bg-slate-900`, `text-emerald-*`, `bg-gradient-*`, `backdrop-blur`, `shadow-emerald`,
`focus:border-emerald`, `accent-emerald`, dst.) ke token Nothing. Dimuat **SETELAH** CDN
Tailwind → menang. Efek: **halaman yang belum dimigrasi manual pun langsung tampil
dalam palet Nothing**. Merah/rose dipetakan ke aksen (danger), emerald/hijau/biru/cyan/
ungu/amber → netral ink. Gradient & glow & blur → dimatikan.

> Konsekuensi: masih ada **string kelas** `bg-emerald-*` di markup beberapa halaman
> manajemen, tapi **secara visual sudah netral**. Pembersihan string per-halaman =
> sisa pekerjaan opsional (bukan blocker). Lihat §5.

---

## 2. Shell admin (semua halaman admin ikut)

- **`partials/admin_header.ejs`** — dirombak total. Buang config Tailwind emerald inline +
  `.glass-panel` + body navy. Sekarang: `<html>` tanpa class `dark`, `<%- include('head_theme') %>`,
  body pakai token. Tetap load leaflet + hls.
- **`partials/admin_sidebar.ejs`** — nav **flat**: item aktif = **kotak hitam** (`bg ink`,
  teks `bg`) + **garis merah 3px** di kiri (bukan glow emerald). Logo = **dot-mark 3×3
  monokrom** (satu titik merah). Label section uppercase mono. **Tombol toggle Light/Dark**
  ditambahkan di footer sidebar (+ ikon di mobile header). Collapse/expand + mobile drawer
  **logic tak berubah** (cuma warna). Tooltip collapsed pakai token.
- **`partials/admin_footer.ejs`** — banner PWA "Install" di-restyle Nothing (surface + garis
  + pill merah). Logika dismiss-persist tak berubah.
- **`partials/global_modal.ejs`** — modal flat squircle, tombol `.n-btn`. Error/confirm =
  ikon + aksen merah. `showModal/hideModal/window.alert/window.confirm` **API tak berubah**.

---

## 3. Halaman yang dimigrasi penuh (bukan sekadar compat)

| View | Perubahan |
|------|-----------|
| `admin_dashboard.ejs` | **Referensi bento.** Kartu statistik → angka **dot-matrix** besar + label mono. Banner server = kartu-kontras (`n-card-black`). Bar CPU/Mem/Disk monokrom — **merah HANYA saat kritis (>80%)**. Service dot: hidup = ink, mati = merah. JS `setBar/updateService` diubah agar inject token, bukan kelas Tailwind warna. IDs & fetch logic tetap. |
| `admin_cameras.ejs` | Badge **`● REC`** (`n-pill-accent` + dot live) = **satu-satunya merah**; `LIVE` = `n-pill` netral. Diubah di EJS render + JS toggle (`rec-toggle-input`). Sisanya (form) ditata oleh compat + `focus/accent` override. |
| `index.ejs` (live wall, publik) | Include `head_theme`. Variabel lokal (`--bg-primary` dst.) **di-alias ke token**. Default tema **light** (dulu dark). `applyTheme()` selalu set `data-theme` (tak lagi hapus atribut). Literal `#10b981/#0f172a` dibersihkan (nav-tab, camera-selected, spinner, canvas watermark→merah, status laut = danger merah). Animasi marquee/fade dipertahankan di atas config bersama. |
| `public_recordings.ejs` (arsip, publik) | Include `head_theme`. Variabel lokal & `.camera-item.active`/`.glass-panel`/`video-wrapper` di-alias ke token. |

---

## 4. Halaman auth (di LUAR scope plan §7a, dikerjakan atas permintaan user susulan)

`login.ejs`, `user-login.ejs`, `register.ejs` — **ditulis ulang** ke satu pola kartu
Nothing: dot-mark logo, hero **dot-matrix** (`LOGIN`/`MASUK`/`DAFTAR`), label mono,
`.n-input` flat, **satu tombol aksen merah**, latar **dot-grid** (`radial-gradient` titik,
bukan gradient warna). Include `head_theme` → ikut token + light/dark. Banner PWA
di-restyle. Stray `</html>` ganda di file lama dibuang.

> **Belum**: `user_account.ejs` (halaman akun pelanggan) masih tema lama — via compat
> tampil netral, tapi belum dirombak khusus. Ditawarkan, user belum minta.

---

## 5. Bersih-bersih (Fase 5)

- **`public/css/modern.css`** — dipensiunkan → **alias** ke token Nothing (dulu var emerald +
  glass + navy). View lama yang masih me-link file ini tak lagi mengembalikan emerald.
- **`public/manifest.json`** + semua `<meta name="theme-color">` → `#F4F4F4` (dulu `#0f172a`).
- **Sisa string emerald** di markup halaman manajemen (`admin_customers/alerts/streaming/
  finance/…`) — **belum** dibersihkan per-string, tapi **dinetralkan compat**. Aman.
- Spot-fix literal keras: `admin_dvr_apk.ejs` (kartu brand/step-indicator emerald→ink,
  gradient icon→`.n-brandbox`), `admin_settings.ejs` (pin peta `#10b981`→`#D71921`).

---

## 6. Verifikasi

- Semua **17 halaman sidebar + shell + 3 auth** render **HTTP 200, 0 error EJS**.
- Font/tema/toggle terpasang (grep rendered HTML: `.n-num` dipakai, `@font-face` ada,
  `toggleTheme`/`data-theme` init ada).
- Screenshot headless (Chrome) mengkonfirmasi: font dot-matrix tampil, aksen-merah-hemat,
  kartu bento, inversi `n-card-black` benar di **light & dark**.
- **Tanpa restart**: semua perubahan view/CSS/asset → **cukup refresh browser** (view
  cache off saat dev; lihat [02-dev-workflow.md](02-dev-workflow.md)). Tidak menambah
  dependency build (Tailwind tetap CDN, font self-host statis).

---

## 7. Yang perlu diketahui sesi berikutnya

- **Jangan** kembalikan emerald/gradient/glass — anti-pola tema ini. Warna baru = token
  `--n-*` atau utility `.n-*`. Merah dipakai **hemat** (danger / 1 aksi primer / status REC).
- Kalau bikin halaman/komponen baru: pakai `.n-card`, `.n-btn`, `.n-label`, `.n-num`, dsb.
  Angka besar/jam/badge teknis → `.n-num` (dot-matrix). Metadata → `.n-label` (mono uppercase).
- Kalau menata ulang halaman manajemen yang masih `bg-emerald-*`: ganti string ke `.n-*`
  saat gilirannya — **compat menutupi sementara**, jadi bukan darurat.
- Semua patch tetap di `app/` (repo clone) → risiko konflik `git pull` upstream. Lihat
  [03-patch-app-clone.md](03-patch-app-clone.md).
