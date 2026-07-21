# Konteks — Fix kontras tema Light (SELESAI, sesi 2026-07-21)

Keluhan user: *"ada beberapa fitur di theme light yang kontennya tidak kelihatan."*
Opsi yang ditawarkan: (1) hapus mode light, atau (2) scan & perbaiki.
**Keputusan: opsi 2.** Light adalah tema **default** ([07-tema-nothing-os.md](07-tema-nothing-os.md));
menghapusnya menyembunyikan cacat, bukan memperbaikinya.

---

## 1. Akar masalah

Tema Nothing bertumpu pada **legacy compat layer** di
[`partials/head_theme.ejs`](../../app/views/partials/head_theme.ejs) — daftar override
manual untuk kelas Tailwind warisan tema dark lama. **Daftar itu tidak lengkap.**
Kelas yang tak terdaftar tetap memakai nilai Tailwind aslinya (warna terang, dirancang
untuk latar navy) → di light jadi **terang di atas terang = tak terlihat**.

Contoh paling telak: compat menangani `text-gray-200/300/400` tapi **melewatkan `-50` dan
`-100`** — persis dua nilai paling terang. Pola bug, bukan kebetulan.

## 2. Kelas cacat yang ditemukan & ditambal

Semua ditambal di compat layer (**satu file, semua halaman ikut**), bukan per-markup:

| Kategori | Masalah | Perbaikan |
|---|---|---|
| Teks paling terang | `text-gray-50/100`, `text-slate-50/100` tak ada aturan | → `--n-ink` |
| Shade pucat | `text-*-200/-300` (dirancang utk latar gelap) | → `--n-ink` / `--n-accent` |
| Shade tua | `text-slate-800/900`, `text-gray-800/900` | → `--n-ink` (gagal di **kedua** tema sebelumnya) |
| Kuning/lime | tak punya aturan sama sekali — **1.26:1**, terparah | → `--n-ink` |
| Hover | `hover:text-white`, `hover:bg-*` (55+ tempat) | attribute selector, semua shade |
| Chip bertint | `bg-*-600/20` + teks pucat = pucat di atas pucat | → `surface-2` + ink |
| "Chip gelap" | `bg-gray-900` + `text-gray-600` → abu di atas abu | → `surface-2` + ink + garis |
| Tombol solid | `bg-blue-600`, `bg-emerald-700` tak tercakup | → tombol ink |
| Warna hilang | indigo/teal/sky/violet/pink tak ada di daftar | ditambahkan |

## 3. Perubahan token (`public/css/nothing.css`)

Beberapa cacat ada di **token**, bukan markup — jadi diperbaiki di sumbernya:

| Token | Sebelum | Sesudah | Alasan |
|---|---|---|---|
| `--n-ink-faint` (light) | `#9A9A9A` | `#696969` | 2.56:1 → AA, juga di atas `surface-2` |
| `--n-ink-faint` (dark) | `#6B6B6B` | `#8A8A8A` | 3.4:1 — **cacat lama di dark**, ikut diperbaiki |
| `--n-ink-soft` (dark) | `#9A9A9A` | `#A8A8A8` | konsistensi |
| `--n-live` (light) | `#0FA3A3` | `#0B7C7C` | 3.02:1 → AA; hue turquois dipertahankan |
| `--n-accent-deep` | — | `#B01019` light / `#FF6068` dark | **token baru**: aksen utk teks di atas chip/tint (aksen normal cuma 4.39:1) |

> `--n-accent` `#D71921` **tidak diubah** — warna khas, sudah aman di atas putih.

## 4. Cache-buster aset (perbaikan tambahan)

`nothing.css` di-link **tanpa versi** → perubahan token bisa tak sampai ke browser
(apalagi ada service worker, lihat [08-ui-kamera-dvr-storage.md](08-ui-kamera-dvr-storage.md)).
Ditambahkan:
- `app.locals.asset_v = APP_VERSION` di [`index.js`](../../app/index.js)
- `href=".../nothing.css?v=<%= asset_v %>"` di `head_theme.ejs`

Karena `scripts/deploy.sh` mengisi `version.js`, **tiap deploy otomatis bust cache CSS.**
⚠️ Konsekuensi: saat dev, ubah token CSS → versi tak berubah → **hard-reload** (Ctrl+F5).

## 5. Cara verifikasi (bukan grep!)

Grep tak tahu warna latar efektif. Dipakai **auditor kontras nyata** via Chrome DevTools
Protocol: telusuri tiap elemen berteks, hitung background efektif menembus ancestor
(termasuk alpha compositing), lalu rasio kontras WCAG.

Hasil akhir — **16 halaman, dua tema**:

| Tema | Hasil |
|------|-------|
| **Dark** | **0 masalah** di semua halaman |
| **Light** | **0 masalah** di semua halaman |

Sisa 1 temuan (`Preview Live Kamera` di PTZ) adalah **false positive**: placeholder
`opacity` di atas kotak `<video>` hitam, hilang begitu stream jalan. Opacity tetap
dinaikkan `40`→`70` biar enak dibaca.

## 6. Yang perlu diketahui sesi berikutnya

- **File mati** — `recordings.ejs`, `recordings1.ejs`, `recordings_backup.ejs`,
  `public_recordings_backup.ejs` **tak pernah dirender** (dicek di `index.js`; yang
  hidup: `public_recordings` & `admin_recordings`). Punya `color: white` inline, tapi
  **jangan buang waktu memperbaikinya**. Kandidat dihapus.
- **Popup Leaflet dikecualikan** — kontainernya putih permanen (dirender library, bukan
  token kita). Ada aturan khusus `.leaflet-popup-content` supaya teks tak jadi
  putih-di-atas-putih saat dark. Jangan "rapikan" jadi token.
- **Knob toggle** `after:bg-white` pada pil gelap itu **benar** — jangan ditambal.
- Kalau menambah kelas Tailwind warna baru di markup, **cek dulu apakah compat
  menanganinya**. Pola cacatnya selalu sama: shade yang tak terdaftar lolos ke light.
- Auditor kontras ada di scratchpad sesi (`audit.js`/`cdp.js`/`run-audit.js`, tanpa
  dependency). Kalau perlu lagi, tulis ulang — polanya: CDP + `Runtime.evaluate`.
