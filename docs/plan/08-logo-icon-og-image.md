# Plan — Ganti Logo, Icon & OG Image

**Status: menunggu aset dari user.** Sisi kode **sudah selesai & terpasang**; yang kurang
hanya file gambar. Begitu file di-drop ke `app/public/`, fitur langsung jalan tanpa
perubahan kode lagi.

Asal-usul: 2026-07-21, user melihat preview link `cctv.sitabumi.my.id` di WhatsApp
menampilkan ikon kamera kecil, lalu minta "ganti favicon itu".

---

## Temuan: yang di WhatsApp itu BUKAN favicon

Preview link WA diambil dari tag **`og:image`** (Open Graph), bukan `<link rel="icon">`.
Waktu itu **tak ada satu pun tag `og:*`** di seluruh `app/views/` — karena itu WA jatuh ke
fallback: mengambil `icon-192x192.png` dari `rel="icon"` dan merendernya kecil di kiri.

Konsekuensi: mengganti file `icon-*.png` saja **tidak** akan membuat preview jadi banner
lebar. Butuh `og:image` khusus 1200×630.

## Yang SUDAH dikerjakan (jangan diulang)

- **[app/views/index.ejs](../../app/views/index.ejs)** — ditambah blok lengkap tag Open Graph
  + Twitter Card tepat setelah `<title>`: `og:type/site_name/title/description/url/image`,
  `og:image:width=1200`, `og:image:height=630`, `twitter:card=summary_large_image`.
  Semua menunjuk ke `<%= og_base %>/og-image.png`.
- **[app/index.js](../../app/index.js)** — di middleware "Global Template Variables"
  (sekitar baris 636) ditambah `res.locals.og_base`: URL **absolut**, karena scraper tidak
  paham path relatif. Menghormati `config.site.public_url` bila diisi; kalau tidak, disusun
  dari `X-Forwarded-Proto` + `req.get('host')` + `base_path` — `X-Forwarded-Proto` penting
  karena di belakang Cloudflare Tunnel `req.protocol` bisa terbaca `http`.

## Yang KURANG — aset dari user

### Wajib (1 file)

| File | Ukuran | Taruh di |
|------|--------|----------|
| `og-image.png` | **1200 × 630 px** | `app/public/og-image.png` |

Nama file harus **persis** `og-image.png` — sudah di-hardcode di tag. Folder `public`
disajikan statis, jadi otomatis terakses di `https://cctv.sitabumi.my.id/og-image.png`.

Aturan desain:
- Rasio 1.91:1. Target **< 300 KB** (WA sering gagal render kalau > 600 KB).
- WA **memotong tepi** saat render → logo & teks di tengah, margin aman ±100 px dari
  semua sisi. Jangan taruh teks mepet pinggir.
- Latar solid gelap senada tema Nothing OS supaya logo kontras.

### Opsional — ganti favicon/PWA sekalian

Timpa file lama di `app/public/` dengan nama yang sama persis (semua bujur sangkar,
logo di tengah):

```
icon-72x72.png   icon-96x96.png   icon-128x128.png  icon-144x144.png
icon-152x152.png icon-192x192.png icon-384x384.png  icon-512x512.png
```

Ada juga `icon.svg` dan `cctv7.png` di folder yang sama.

> Mesin dev **tidak punya ImageMagick** (`convert` yang ada di PATH itu utilitas
> filesystem Windows, bukan IM) — resize otomatis tidak bisa. Sarankan user pakai
> realfavicongenerator.net dari satu file 512×512, atau siapkan manual.

## Verifikasi setelah aset masuk + deploy

1. Buka `https://cctv.sitabumi.my.id/og-image.png` — gambar harus tampil.
2. WA **cache preview lama cukup lama**. Paksa refresh dengan pembeda query:
   `https://cctv.sitabumi.my.id/?v=2`. Berhasil = banner lebar, bukan ikon kecil.
3. Cek resmi: [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) →
   tempel URL → **Scrape Again**. Tool paling jujur untuk melihat apa yang dibaca scraper.

## Catatan lanjutan

- OG tag baru dipasang di `index.ejs` saja (halaman yang dishare user). Kalau nanti
  halaman login/publik lain juga perlu preview, **pindahkan blok itu ke partial bersama**
  (mis. `partials/head_theme.ejs` atau partial `head_og.ejs` baru) agar tidak duplikat.
- `config.site.public_url` belum tentu ada di `config.json`. Kalau preview salah domain
  (mis. ikut host internal), isi field itu dengan `https://cctv.sitabumi.my.id`.
