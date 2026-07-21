# Plan 4 — Poles UI Kamera

**Tujuan:** rapikan halaman **Daftar Kamera** + form tambah kamera yang baru direfaktor
(form kini hidden default, dibuka via tombol "Tambah Kamera").

**Kompleksitas:** Rendah. Murni front-end di [admin_cameras.ejs](../../app/views/admin_cameras.ejs).

## Kondisi sekarang (hasil refaktor sesi ini)
- Panel form add **hidden default**, dibuka via tombol hijau "Tambah Kamera" di header tabel.
- Tombol close (✕) di header form. `openCameraForm()/closeCameraForm()/resetCameraForm()`.
- Tipe RTSP vs Embed via dropdown "Tipe Kamera" (1 pintu).
- Query `?add=1` / `?type=` masih dihormati.
- Menu APK & P2P disembunyikan dari sidebar.

## Kandidat perbaikan (pilih saat eksekusi)

### A. Empty state
- Kalau `cameras.length === 0`: tampilkan ilustrasi + teks "Belum ada kamera" + tombol
  "Tambah Kamera Pertama" (memanggil `openCameraForm()`), bukan tabel kosong.

### B. Transisi / animasi form
- Form dibuka: fade/slide-down halus (bukan langsung `display:block`). Perhatikan Leaflet
  `invalidateSize()` tetap dipanggil setelah transisi selesai.

### C. Validasi input lebih jelas
- Validasi RTSP URL di client sebelum submit (regex `rtsp://`), pesan inline (bukan hanya
  modal error dari server).
- Highlight field wajib yang kosong.

### D. Feedback tombol
- Tombol "Tambah Kamera" saat form terbuka bisa berubah jadi "Tutup Form" / disabled,
  supaya jelas state-nya.

### E. Konsistensi filter & badge
- Badge tipe (RTSP/Embed) + level sudah ada; tambah badge **REC/LIVE** kalau plan #1 sudah
  jalan (integrasikan setelah record per-kamera).

## Titik uji
- 0 kamera → empty state muncul, tombol buka form.
- Buka/tutup form beberapa kali → peta tetap render benar (tidak abu-abu).
- Submit URL RTSP invalid → pesan validasi jelas tanpa reload.

## Catatan
- Kerjakan setelah #1 (biar badge REC/LIVE bisa langsung diintegrasikan) — tapi bisa juga
  jalan mandiri. Prioritas paling rendah dari 4 fitur.
