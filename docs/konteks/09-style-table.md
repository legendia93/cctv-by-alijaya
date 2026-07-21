# Konteks — Pola Styling Tabel Admin (referensi, sesi 2026-07-21)

Pola visual tabel yang dipakai di **Permission Manager**
([`app/views/admin_permissions.ejs`](../../app/views/admin_permissions.ejs)) —
disetujui sebagai acuan untuk tabel admin berikutnya.

Prinsipnya: **transparan + garis tipis**, bukan bidang abu solid. Struktur dibaca dari
garis dan hover, bukan dari blok warna. Cocok dengan tema Nothing OS
(lihat [07-tema-nothing-os.md](07-tema-nothing-os.md)).

---

## 1. Kerangka: card transparan

```html
<div class="n-card p-6 mb-8" style="background:transparent;">
```

`n-card` dipakai untuk border + radius, tapi **background-nya dimatikan** supaya menyatu
dengan kanvas halaman.

> ⚠️ **Jangan** pakai `bg-gradient-to-br from-gray-800 via-gray-850 to-gray-900`.
> `gray-850` **bukan warna Tailwind** (tidak ada di palet standar) → gradien rusak dan
> menghasilkan semburat kebiruan. Ini bug yang sempat ada di halaman ini.

## 2. CSS tabel

```css
/* Semua sel transparan; struktur hanya dari garis. */
.perm-table td, .perm-table th { background: transparent; }
.perm-item td { border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
.perm-table tbody tr.perm-item:hover td { background: rgba(255, 255, 255, 0.035); }

/* Baris judul section: bidang SANGAT tipis, cukup jadi pemisah kelompok. */
.perm-group-row { cursor: pointer; user-select: none; }
.perm-group-row td {
    background: rgba(255, 255, 255, 0.025);
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}
.perm-table tbody tr.perm-group-row:hover td { background: rgba(255, 255, 255, 0.055); }
```

### Skala opacity yang dipakai (putih di atas dark)
| Nilai | Untuk |
|-------|-------|
| `0.025` | bidang baris section (istirahat) |
| `0.035` | hover baris item |
| `0.05`  | garis bawah baris item |
| `0.055` | hover baris section |
| `0.07`  | garis atas/bawah baris section |

**Selektor harus di-scope** ke `tr.perm-item` / `tr.perm-group-row`. Kalau ditulis
`tbody tr:hover td` saja, hover baris biasa ikut menimpa warna baris section.

## 3. Toggle ON/OFF berwarna

Toggle monokrom (knob putih, track abu) **sulit dibaca** — arah on/off cuma bisa ditebak
dari posisi knob. Pola ini mengubah track, border, **dan** knob sekaligus:

```css
.perm-sw {                                   /* OFF = merah */
    position: relative; display: inline-flex; align-items: center;
    width: 42px; height: 22px; border-radius: 999px; cursor: pointer;
    background: rgba(244, 63, 94, 0.18); border: 1px solid rgba(244, 63, 94, 0.45);
    transition: background .15s ease, border-color .15s ease;
}
.perm-sw::after {
    content: ''; position: absolute; left: 2px; top: 50%; transform: translateY(-50%);
    width: 16px; height: 16px; border-radius: 50%;
    background: #f43f5e; transition: transform .18s ease, background .15s ease;
}
.perm-sw.on { background: rgba(16, 185, 129, 0.18); border-color: rgba(16, 185, 129, 0.5); }
.perm-sw.on::after { transform: translateY(-50%) translateX(20px); background: #10b981; }
.perm-sw.locked { opacity: .35; cursor: not-allowed; }
```

- OFF `#f43f5e` (rose-500) — **sama dengan merah tombol Reset All / Nonaktifkan**
- ON `#10b981` (emerald-500)
- `.locked` = opacity 35%, untuk state yang tak boleh diubah user

> Toggle di-render sebagai `<span>` + class, **bukan** `<input type=checkbox>`. Klik
> hanya menukar class (`classList.toggle('on')`) — tidak render ulang tabel, jadi tak
> ada kedipan. Catatan: atribut `disabled` pada `<div>`/`<span>` **tidak berefek**;
> pakai class `.locked` + guard di fungsi handler.

## 4. Warna teks (jangan terlalu redup)

Di tema gelap, `text-gray-500`/`600` terlalu samar. Skala yang dipakai:

| Elemen | Class |
|--------|-------|
| Nama fitur (utama) | `text-gray-50 font-medium` |
| Nama section | `text-gray-100` |
| Angka hitungan, header kolom, legenda | `text-gray-300` |
| Deskripsi sekunder, subtitle | `text-gray-400` |

## 5. Struktur & interaksi

- **Baris = fitur, kolom = level.** Untuk data perbandingan, transposisi ini jauh lebih
  terbaca daripada kolom sempit berjejer (versi lama: 11 kolom, tak terbaca).
- **Section = baris di dalam tabel**, bukan card terpisah. Seluruh baris jadi tombol
  collapse (`cursor:pointer` + chevron rotate 90°). **Default tertutup.**
- Baris section tetap menampilkan **ringkasan saat tertutup** — jumlah item `(4)` dan
  hitungan aktif per kolom `3/4` — supaya tak perlu dibuka hanya untuk mengintip.
- **Aksi cepat ditaruh di atas**, menempel pada badge levelnya; jangan ditumpuk di bawah
  tabel. Tombol global (`Buka Semua`/`Tutup Semua`) samakan ukurannya dengan tombol
  header: `text-[10px] px-3 py-1.5 rounded-lg`.
- Sertakan **legenda** di bawah tabel (Aktif / Nonaktif / Terkunci).

## 6. Yang sengaja TIDAK dipakai

| Ditinggalkan | Alasan |
|--------------|--------|
| Sticky column (`position:sticky`) | butuh background solid → bentrok dengan tabel transparan |
| Zebra striping | idem — butuh bidang warna |
| Emoji ✅/❌ sebagai penanda | render kecil & ramai; pakai `&#10003;` / `&#10007;` ber-warna |
| Tab per-level | memaksa klik bergantian untuk membandingkan; jadikan kolom saja |

---

**Contoh terpasang:** `app/views/admin_permissions.ejs` (tabel + toggle + collapse),
`app/views/admin_customers.ejs` (matriks perbandingan level, varian ✓/✗ tanpa toggle).
