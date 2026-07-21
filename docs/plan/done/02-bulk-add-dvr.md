# Plan 2 — Bulk Add Channel DVR/NVR

**Tujuan:** dari 1 DVR/NVR, admin isi IP/user/pass + rentang channel (mis. 1–16), app
**otomatis membuat banyak entry kamera** sekaligus — tidak lagi manual 1 channel = 1 kamera.

**Kompleksitas:** Sedang. Template RTSP per-brand sudah ada, tinggal loop + batch insert.

## Kondisi sekarang
- Halaman [admin_dvr_apk.ejs](../../app/views/admin_dvr_apk.ejs) sudah punya **template
  RTSP per-brand dengan token `{channel}`** (~baris 530+), mis. Hikvision
  `.../Streaming/Channels/{channel}01`, Dahua `.../cam/realmonitor?channel={channel}&subtype={subtype}`.
- Saat ini URL-builder hanya generate **satu** URL per submit; user salin manual ke form tambah.
- Route add kamera per-satuan: `POST /admin/camera/add` ([index.js:3296](../../app/index.js#L3296)).

## Perubahan yang direncanakan

### A. Backend — endpoint bulk add
File: [app/index.js](../../app/index.js).
1. Endpoint baru `POST /api/dvr/bulk-add` (requireApiAuth). Body:
   `{ brand, ip, port, username, password, channelStart, channelEnd, subtype?, level, lokasi, namePrefix }`.
2. Validasi: `channelEnd >= channelStart`, jumlah channel dibatasi (mis. **max 64**),
   kredensial & IP wajib.
3. Untuk tiap channel: bangun `url_rtsp` dari **template brand yang sama** dengan yang dipakai
   URL-builder (samakan sumber template — pindah ke modul share atau duplikasi konstanta
   di server). Validasi tiap URL via `isValidRtspUrl`.
4. Batch INSERT ke `cameras` (transaksi / serial), lalu **`registerCamera` per entry**
   supaya MediaMTX + transcode jalan. Kembalikan ringkasan `{ added: n, failed: [...] }`.
5. Nama default: `"{namePrefix} CH{channel}"` (mis. "DVR Gudang CH1").

### B. UI — form bulk di halaman DVR/NVR
File: [admin_dvr_apk.ejs](../../app/views/admin_dvr_apk.ejs).
1. Tambah section **"Tambah Massal (Bulk)"**: pilih brand, IP, port, user, pass,
   channel start–end, level, lokasi, prefix nama.
2. Tombol **"Preview"**: tampilkan daftar URL yang akan dibuat (biar admin cek sebelum commit).
3. Tombol **"Tambah Semua"**: POST ke `/api/dvr/bulk-add`, tampilkan progress + hasil
   (berhasil/gagal per channel).

### C. Refactor kecil (opsional tapi disarankan)
- Template brand saat ini ada **di client** (EJS `<script>`). Untuk bulk server-side, template
  harus tersedia di server juga. Pilihan:
  - (a) Pindah tabel template ke file share `app/utils/rtspTemplates.js`, `require` di server,
    dan expose ke client via endpoint/JSON. **← disarankan (satu sumber kebenaran).**
  - (b) Duplikasi konstanta template di server (cepat tapi rawan drift).

## Titik uji
- Bulk add Hikvision ch 1–4 → 4 entry kamera dengan URL `...Channels/101,201,301,401`.
- Channel yang URL-nya invalid masuk daftar `failed`, tidak menggagalkan yang lain.
- Semua entry baru muncul `ready` di MediaMTX (kalau DVR reachable).

## Risiko / catatan
- DVR nyata sering channel besar = sub-stream; mapping `{channel}01` vs subtype beda per merek.
  Preview URL wajib supaya admin bisa koreksi sebelum commit.
- Batasi jumlah channel untuk cegah spam transcode (beban CPU). Default max 16, keras 64.
