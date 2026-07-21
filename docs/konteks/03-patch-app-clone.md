# Konteks — Perubahan Kode di app/

Daftar semua modifikasi pada kode hasil clone (`app/`). PENTING: kalau nanti `git pull`
update dari upstream, patch ini bisa konflik.

## File BARU

| File | Isi |
|------|-----|
| `app/utils/membership.js` | Logika level & expiry: `getEffectiveLevel`, `isActive`, `canPlayCamera`, `playableLevelsFor`, `OWNER_SCOPED_LEVELS` (via env `CCTV_OWNER_SCOPED_LEVELS`). |
| `app/.gitattributes` | Paksa `*.sh` = LF (cegah CRLF dari clone Windows). |
| `app/utils/rtspProbeCandidates.js` | `RTSP_CANDIDATES` (34 path, de-dup) + `RTSP_PORTS` `[554,8554,10554,555,5554]` untuk auto-probe (Plan #5). Dipakai `/api/rtsp/detect-streams`; disiapkan untuk reuse Plan #2 bulk DVR. |
| `app/utils/rtspTemplates.js` | **Satu sumber kebenaran template RTSP per-brand** (Plan #2). Ekspor `BRAND_TEMPLATES`, `buildRtspUrl(brand,opts)`, `templateHasChannel(brand)`. Dipakai server-side bulk-add + client via `/api/dvr/brand-templates`. Meniru persis logika generator client (encode kredensial, isi default, ganti token `{key}`). |
| `app/public/css/nothing.css` | **Design token layer tema "Nothing OS"** (Plan #6). CSS var light/dark + utility `.n-*`. Detail: [07-tema-nothing-os.md](07-tema-nothing-os.md). |
| `app/views/partials/head_theme.ejs` | `<head>` bersama tema Nothing: font, Tailwind config token, **legacy compat layer**, init tema (light default). Detail: [07-tema-nothing-os.md](07-tema-nothing-os.md). |
| `app/public/fonts/ndot.ttf` (+`OFL.txt`) | Font dot-matrix Pixelify Sans (OFL), self-host. |

## app/index.js — perubahan

0. **DEV: `app.set('view cache', false)` saat `DEV_MODE=1`** (tepat setelah
   `app.set('view engine','ejs')`). Fix: edit `.ejs` dulu tidak muncul karena EJS
   cache template di memori. Sekarang view langsung tampil tanpa restart. Prod tetap cache.
   Terkait: `docker/entrypoint.sh` nodemon dapat flag `--legacy-watch` (polling; di
   Windows tetap kurang andal untuk `.js` → pakai `docker restart`).

1. **Import membership util** (dekat import utils lain):
   `getEffectiveLevel, playableLevelsFor, canPlayCamera, isActive as isMembershipActive`.

2. **HLS proxy → fungsi `proxyHlsToMediaMtx(req,res)`** + host pakai
   `getEffectiveMediaMtxHost(config)` (bukan hardcode `127.0.0.1`).
   Helper cache: `getCameraAccessInfo()`, `HLS_AUTH_CACHE`, `HLS_AUTH_TTL=15000`.

3. **HLS authorization gate** (C1) — `app.use` yang mengecek izin sebelum proxy `/cam_*`.
   PENTING: didaftarkan **SETELAH** session middleware (sekitar setelah baris ~572,
   sesudah `sessionMiddleware`), bukan di tempat proxy lama — karena butuh `req.session`.
   Anon ke kamera non-`umum` → 403. Admin → selalu boleh.

4. **Login customer** (`POST /user/login`): session simpan `level` (effective),
   `stored_level` (asli), `active_until`. Effective level = `getEffectiveLevel(user)`.

5. **Gate `/`, `/archive`, dan 2 endpoint lain**: level pelanggan dihitung ulang tiap
   request via `getEffectiveLevel({level: c.stored_level||c.level, active_until: c.active_until})`.
   (4 tempat, semua yang tadinya `const level = (c.level||'umum').toLowerCase()`.)

6. **Scheduler `expireMembershipsJob()`** (C2): tiap 6 jam + saat start. UPDATE
   `users SET level='umum'` untuk yang `active_until` lampau. Ditambah di blok
   `setInterval` dekat baris ~5750-an.

## app/views/partials/admin_sidebar.ejs — perubahan

Menu grup "Kamera & Media". Riwayat: awalnya 2 item (RTSP, Embed) → sempat jadi 3
(Daftar / Tambah RTSP / Tambah Embed) → lalu 2 (Daftar / Tambah Kamera).
**Sekarang tinggal 1 item add-flow**:
- `Daftar Kamera` → `admin/cameras#daftar-kamera` (pageName `cameras`)

Tidak ada lagi item "Tambah Kamera" di sidebar — diganti tombol hijau **"Tambah
Kamera"** di header tabel Daftar Kamera (buka form add). Tambah RTSP vs Embed = **1
pintu**, tipe dipilih di dropdown "Tipe Kamera" dalam form. Query lama
`?add=1` dan `?type=rtsp|embed` masih dihormati halaman (buka form + preselect).

## app/views/admin_cameras.ejs — perubahan

- Form tambah/edit: `id="form-kamera"`, **default `display:none`** (disembunyikan).
  Header form dapat tombol close (`closeCameraForm()`).
- List kamera (`#daftar-kamera`): header dapat tombol hijau **"Tambah Kamera"**
  (`openCameraForm()`) — ini pengganti panel add yang dulu selalu tampil di atas.
- JS baru: `openCameraForm(reset)` / `closeCameraForm()` / `resetCameraForm()`.
  `openCameraForm` panggil `map.invalidateSize()` (Leaflet init saat hidden → perlu
  recalculate ukuran). Tombol Edit & `selectOnvif()` panggil `openCameraForm(false)`.
- `applyOpenFromQuery()` (ganti `applyTypeFromQuery`): buka form kalau `?add=1` atau
  `?type=rtsp|embed`; kalau ada `?type`, preselect dropdown. `closeCameraForm` bersihkan
  query dari URL via `history.replaceState`.

## Plan #5 — Deteksi Stream Terbaik (auto-probe RTSP)

- **Endpoint baru `POST /api/rtsp/detect-streams`** (`requireApiAuth`, setelah
  `/api/dvr/test-rtsp`). Terima `{input, username, password, port}`; `input` bisa IP saja
  atau URL `rtsp://` lengkap (dipecah jadi host/port/cred).
  - **Pre-check TCP** ke `host:port` (timeout 4 dtk) sebelum probe → kalau port tutup,
    balik `reachable:false` cepat (hindari 20× timeout ffprobe).
  - **Multi-port**: kalau user tak sebut port, scan `RTSP_PORTS` paralel & pakai port
    terbuka pertama (prioritas urut list). 8554 penting utk kamera Tuya/SmartLife/Avaro.
    Kalau user sebut port (via `:PORT` atau field), cek port itu saja. Port dipilih
    dikembalikan di `data.port` (ditampilkan UI).
  - **Deteksi cloud-only**: `checkPort` bedakan `open` / `refused` (ECONNREFUSED =
    host hidup, port ditutup) / `down` (timeout/unreachable). Kalau tak ada port terbuka
    TAPI ada yg `refused` → host jelas hidup, cuma tak buka RTSP → balik
    `{reachable:false, cloudOnly:true}` + pesan "kamera cloud-only (V380/Tuya, RTSP
    dimatikan), aktifkan ONVIF/RTSP di app". UI render amber ☁️ (bukan merah error).
    Ping ICMP TIDAK dipakai — `ping` tak ada di container Debian minimal & butuh raw
    socket; ECONNREFUSED lebih andal (banyak kamera cloud jawab ping tapi drop TCP).
    Terverifikasi: V380 `10.10.70.148`/`.249` = semua refused → CLOUD-ONLY.
  - Probe tiap kandidat via `ffprobe -rtsp_transport tcp ... -of json` (`execCmd`,
    **timeout 7 dtk**), **paralel batch 4** (batch kecil supaya kamera murah tak drop
    main-stream HEVC 2K saat banyak koneksi bareng). **Early-exit** begitu dapat main
    (`>=1280`) + ≥2 hasil; **budget total ~25 dtk**. Dedup by `width×height×codec`, urut
    resolusi tertinggi dulu, tandai `>=1280` "Main Stream", hitung `ratio` (gcd).
  - Kredensial disertakan di `url` hasil; pesan/log pakai `safeAuthority` tanpa cred.
  - **CATATAN operasional:** probe berjalan dari mesin/container Node, bukan browser —
    IP kamera harus reachable dari sana. **Ubah `.js` → wajib `docker restart lookna`.**
  - **Terverifikasi** vs kamera Avaro/Tuya `10.10.111.4`: auto-pilih port 8554, temukan
    `/main` (2880×1620 HEVC) + `/sub` (640×360 H264) dalam ~7.5 dtk.
- **UI `admin_cameras.ejs`** (dalam `#rtsp-fields`): tombol **"🔍 Deteksi Stream"** di
  sebelah label URL, 2 field opsional user/pass deteksi (`#detect_username/password`),
  container hasil `#detectResults`. Fungsi `detectStreams()` render kartu resolusi+codec+
  rasio+label, badge "Rekomendasi" di baris pertama, warning rasio ≠ 16:9, tombol "Pakai"
  → isi `#edit_url_rtsp`. Kasus `cloudOnly` dirender amber ☁️ (bukan merah error).

### Batas kamera V380 cloud-only (kesimpulan lapangan)

Ada kamera V380/XM yang **tidak menjalankan RTSP server sama sekali** — semua trafik
outbound ke cloud XM. Ciri di deteksi: **ping OK tapi 0 port TCP terbuka** (semua
`ECONNREFUSED`). Contoh terverifikasi: `10.10.70.148`, `10.10.70.249`.

**Kesimpulan: kamera V380 tanpa menu ONVIF/RTSP = TIDAK BISA ditarik via RTSP.** Yang
sudah dicoba & mentok:
- App V380 Pro → Settings: menu ONVIF/RTSP memang **tidak ada** di model ini.
- **Flash firmware via SD card** untuk unhide setting ONVIF (ubah value config):
  **dicoba, GAGAL** — setting tetap tak muncul (vendor kunci config/firmware tolak).

Keputusan (user): **menyerah untuk V380 tanpa ONVIF**, ini langkah paling tepat —
memaksa flash lebih jauh berisiko brick untuk hasil belum tentu ada. Kamera cloud-only
begini di luar jangkauan sistem RTSP; alternatif hanya ganti kamera atau (tidak
disarankan) rekayasa protokol cloud XM/dvrip. Kontras: kamera Tuya/Avaro `10.10.111.4`
diam-diam buka RTSP di 8554 → tetap bisa. Jadi "punya app cloud" ≠ "pasti cloud-only";
yang menentukan = ada tidaknya RTSP server yang listen.

## Plan #4 — Poles UI Kamera (front-end `admin_cameras.ejs`)

- **A. Empty state**: kalau `cameras.length === 0`, `#emptyStateRow` (ilustrasi + teks +
  tombol "Tambah Kamera Pertama"). Search & `sortTable` kini query `tr.camera-row` saja
  (hindari error di baris empty-state yang tak punya `.font-bold`).
- **C. Validasi client**: `validateCameraForm()` dipanggil di `onsubmit` — nama wajib,
  RTSP harus `rtsp://` (regex) / embed URL wajib. Helper `markInvalid/clearInvalid`
  (border merah + pesan `.field-error` inline).
- **D. Feedback tombol**: tombol header jadi `toggleCameraForm()` (`#toggleFormBtn`),
  label & ikon toggle "Tambah Kamera" ↔ "Tutup Form" via `setToggleBtnState()`,
  disinkronkan dari `openCameraForm`/`closeCameraForm`.
- Tidak dikerjakan: B (animasi form).
- **E. Badge REC/LIVE** (Plan #1): baris tabel kamera RTSP kini tampil badge `● REC`
  (rose) bila `enable_recording !== 0`, atau `LIVE` (amber) bila live-only.

## Plan #1 — Record per kamera (SELESAI)

- **`updateMediaMtxRecording()`**: query `SELECT id, enable_recording`; per path
  `cam_X` set `record: shouldRecord && (cam.enable_recording !== 0)`. Global window
  tetap berlaku; per-kamera hanya bisa **mematikan** rekam (default 1 = tetap rekam).
- **`POST /admin/camera/add` & `/edit` (branch RTSP)**: baca `req.body.enable_recording`
  (`'0'`→0, selain itu→1; checkbox unchecked tak terkirim → default rekam). Setelah
  `registerCamera` → panggil `updateMediaMtxRecording()` supaya MediaMTX langsung sinkron
  tanpa nunggu cron window. Branch embed tak berubah (tetap `isHls ? 1 : 0`).
- **`admin_cameras.ejs`**: checkbox "Rekam ke storage" di `#rtsp-fields` (default checked),
  `data-enable_recording` di tombol edit, isi state saat edit, badge REC/LIVE di tabel.

## Plan #2 — Bulk add DVR/NVR (SELESAI)

- **`GET /api/dvr/brand-templates`** (requireApiAuth): kirim `BRAND_TEMPLATES` ke client
  untuk preview.
- **`POST /api/dvr/bulk-add`** (requireApiAuth): body `{brand, ip, port, username,
  password, channelStart, channelEnd, stream, level, lokasi, namePrefix, is_public,
  enable_recording}`. Validasi brand + `templateHasChannel` + rentang channel (max 64) +
  kredensial/IP. Loop serial: `buildRtspUrl` → `isValidRtspUrl` → INSERT (nama
  `"{prefix} CH{ch}"`) → `registerCamera`. Sekali `updateMediaMtxRecording()` di akhir.
  Return `{added:[...], failed:[{channel,reason}], addedCount, failedCount}` — 1 channel
  gagal tak menggagalkan yang lain.
- **`admin_dvr_apk.ejs`**: section "Tambah Massal (Bulk)" — form (brand dari endpoint,
  hanya merek ber-`{channel}`), tombol **Preview URL** (bangun URL di client, password
  disamarkan `••••`), tombol **Tambah Semua** (aktif setelah preview valid), tampil
  ringkasan hasil + daftar channel gagal.
- Template client lama (`BRAND_INFO` di `<script>`) **belum** dimigrasi ke modul share —
  generator single-URL masih pakai `BRAND_INFO` sendiri. Modul share hanya dipakai bulk
  (server + preview bulk). Potensi drift; konsolidasi menyusul bila perlu.

## Plan #4 lanjutan — Poles UI Kamera (SELESAI, iterasi 2)

`admin_cameras.ejs` dirombak layout + interaksi:

- **Layout 2 kolom** (`grid xl:grid-cols-3`): kiri (`xl:col-span-2`) = Daftar Kamera saja
  (bersih); kanan (`xl:col-span-1`, stack) = **ONVIF Scan + Generator URL RTSP**. Grid
  internal kedua tool diturunkan ke 1 kolom biar muat di kolom sempit. Di bawah breakpoint
  `xl`, kolom kanan turun ke bawah (responsif).
- **Form Tambah/Edit jadi MODAL pop-up**: dibungkus `#cameraModalBackdrop`
  (`fixed inset-0 z-[1000]`, overlay gelap + blur, center, scrollable). `openCameraForm/
  closeCameraForm/toggleCameraForm` kini toggle backdrop (`hidden`↔`flex`) + kunci
  `body.overflow`. Tutup via: tombol ✕, **klik backdrop**, atau **Esc**. Leaflet
  `invalidateSize()` tetap dipanggil saat modal tampil (peta tak abu-abu); `map.setView`
  saat edit di-`setTimeout` supaya jalan setelah modal render.
- **Peta diperkecil**: `#inputMap` tinggi `350px` → `200px`.

## Plan #1 lanjutan — Toggle rekam di kolom Kelola (SELESAI)

- **`POST /admin/camera/toggle-recording`** (requireAuth): body `{id, enable}`. Update
  `enable_recording` di DB + `updateMediaMtxRecording()` supaya MediaMTX langsung sinkron.
  Tolak kamera `embed` (toggle tak relevan). Return `{success, id, enable_recording}`.
- **`admin_cameras.ejs`**: toggle switch (peer-checkbox Tailwind) di kolom **Kelola**,
  **selalu terlihat** (tak ikut `opacity-0 group-hover`), hanya untuk RTSP. Merah = REC,
  abu = LIVE. `.rec-toggle-input` change → fetch endpoint, update badge
  `#rec-badge-<id>` di kolom Identitas tanpa reload, rollback bila gagal.

## partials/admin_footer.ejs — banner PWA "Install"

- Banner install PWA (`beforeinstallprompt`) sebelumnya muncul tiap halaman; tombol
  **Tutup** cuma `remove()` → nongol lagi. Kini **dismiss dipersist** di
  `localStorage['pwa_install_dismissed']='1'`; `showBanner()` cek `isDismissed()` di awal.
  Sekali ditutup, tak muncul lagi. Fitur install tetap ada.

## app/*.sh — konversi CRLF→LF

9 file `.sh` dikonversi ke LF di host (deploy_server, fix_mediamtx, install,
install_ubuntu, record_notify, smart_transcode, start, transcode, uninstall).

## Isolasi per-user + ciutkan level (SELESAI — sesi 2026-07-20)

Model bisnis diputuskan: **SaaS per-pelanggan**. Detail lengkap perilaku di
[05-membership-isolasi-user.md](05-membership-isolasi-user.md); ringkasan perubahan kode:

### `app/utils/membership.js`
- `OWNER_SCOPED_LEVELS` default diubah `['vvip']` → **`['vvip','pemerintahan','vip','member']`**
  (semua level berbayar owner-scoped). Tetap bisa override via env `CCTV_OWNER_SCOPED_LEVELS`.
  Efek: stream gate (C1) via `canPlayCamera` kini isolasi per-pemilik untuk semua kamera non-`umum`.

### `app/index.js` — route `/`, `/archive`, `/api/recordings`
- **Query tile difilter per-user**: `WHERE ... AND (LOWER(level)='umum' OR owner_id = ?)`
  untuk customer login; anonim `WHERE LOWER(level)='umum'` saja. Kamera non-`umum` tanpa
  `owner_id` → tak tampil ke customer (hanya admin). Menggantikan filter lama yang cuma
  owner-scope `vvip`. Variabel `isVVIP` lama masih ada tapi tak dipakai di query (harmless).
- **Route `/`**: tiap kamera diberi flag `isOwned` (non-umum & `owner_id===customerId`),
  di-`sort` owned-first, dan `hasOwnedCameras` dikirim ke view.

### `app/views/index.ejs` — owned-first + umum collapse
- `HAS_OWNED_CAMERAS` (dari server) + `selectDefaultCameras()`: saat **belum ada state
  tersimpan** (login pertama / localStorage kosong), grid auto-buka kamera milik user;
  kamera umum TIDAK auto-buka. Dipanggil dari `loadState()` (cabang no-saved / validIds kosong).
- Sidebar: kalau `hasOwnedCameras`, item dibagi section **"Kamera Saya"** (tampil) +
  **"Kamera Umum (N)"** (tombol `toggleUmumSection`, item ber-class `umum-cam hidden`).
  `data-owned` per item. User tanpa kamera / anonim: umum tampil normal (tanpa collapse).
- `filterCameras()` diperbaiki: saat search, umum ikut muncul; saat term kosong & section
  collapsed, umum di-`hidden` lagi.

### `app/views/admin_cameras.ejs` — bind UI + kolom Pemilik + rapikan modal
- **Field "Pemilik Kamera (Bind ke User)"** (`#owner-field`, `select[name=owner_id]`)
  di form, opsi dari `users` (dikirim route `/admin/cameras`, sudah ada sejak dulu).
  `toggleOwnerField()`: tampil hanya saat level ≠ `umum`; `data-owner_id` di tombol edit;
  di-load saat edit, di-reset saat tambah. Backend `/admin/camera/add|edit` sudah baca
  `owner_id` (tak berubah).
- **Kolom tabel "Pemilik"**: lookup `userById` (owner_id→"Nama (@user)"). Umum→"Publik
  (komunal)", privat+owner→👤 nama, privat tanpa owner→"⚠ Belum di-bind". `colspan` empty-state 5→6.
- **Modal dirapikan**: form `grid-cols-4 items-end` (berantakan) → **`space-y-5` baris
  logis** (identitas 4-kol / pemilik full-width / sumber stream / koordinat / peta /
  footer Batal+Simpan). ⚠️ Sempat ada bug **`<div>` ganda** (baris peta) → 1 div tak
  tertutup → konten halaman "tertelan" ke modal hidden (halaman blank). SUDAH diperbaiki
  (div balance 73/73). Kalau edit lagi: cek `<div>` open==close.

### `admin_customers.ejs`, `admin_permissions.ejs` — ciutkan level
- Dropdown level pelanggan/kamera & tab Permission Manager diciutkan ke **UMUM / MEMBER
  (+ ADMIN)**. vvip/vip/pemerintahan disembunyikan dari picker; logika hierarki masih ada
  (kamera lama tetap jalan). `VISIBLE_LEVELS=['umum','member','admin']` filter di customers;
  tab permissions `['admin','member','umum']`. TIDAK ada CRUD level (masih hardcode).

## Redesign UI tema "Nothing OS" (SELESAI — sesi 2026-07-20)

Bahasa visual seluruh app diganti dari dark-navy+emerald ke **Nothing OS** (monokrom +
aksen merah, dot-matrix, light-default+dark). **Nol perubahan logika server.** File shell
(`admin_header/sidebar/footer`, `global_modal`), `admin_dashboard`, `admin_cameras` (badge
REC/LIVE), `index`, `public_recordings`, dan auth (`login/user-login/register`) ditata ulang;
sisanya dinetralkan via legacy compat layer di `head_theme.ejs`. `modern.css` dipensiunkan
→ alias token. **Detail lengkap ada di dokumen khusus: [07-tema-nothing-os.md](07-tema-nothing-os.md).**

> ⚠️ Catatan: deskripsi warna emerald/rose/amber di bagian-bagian ATAS file ini (mis. badge
> "rose/amber", tombol hijau "Tambah Kamera", nav-link emerald) menggambarkan kondisi
> SEBELUM redesign. Fungsionalitasnya masih sama; **tampilannya kini mengikuti token Nothing.**

## Perbaikan halaman PTZ + deteksi kapabilitas (SELESAI — sesi 2026-07-21)

Gejala awal user: buka `/admin/ptz`, pilih kamera → preview **stuck "Memuat stream..."**
selamanya. Ternyata ada **3 bug terpisah**, dan investigasinya menghasilkan temuan
lapangan penting soal kamera clone (lihat sub-bagian terakhir).

### 1. Stream URL salah (penyebab utama stuck loading)

`admin_ptz.ejs` membangun URL `${hlsBaseUrl}/${id}/index.m3u8` → minta path `/8/index.m3u8`
yang **tak pernah ada** di MediaMTX. Stream key yang benar `cam_<id>` (lihat
[04-streaming-transcode.md](04-streaming-transcode.md)); `index.ejs` sudah benar sejak dulu.
Diperbaiki + **fallback ke `cam_<id>_input`** (pola sama seperti `index.ejs`), plus
handler error yang menampilkan "Stream tidak tersedia" alih-alih spinner abadi.

### 2. Tombol PTZ nembak endpoint yang tak ada

View POST ke **`/api/onvif/ptz`** — route ini **tidak pernah dibuat**. Yang ada
`POST /api/cameras/:id/ptz` dengan body beda (`{action:'move', x, y, zoom}`, bukan
`{action:'up', speed}`). Jadi semua tombol 404 walau kameranya PTZ beneran.
Ditambah peta `PTZ_VECTORS` di client (arah → vektor `x/y/zoom`, `zoom_in/out` →
`action:'zoom'`), semua lewat helper `sendPtz()`.

### 3. `cam.ptz` tidak ada → `socket hang up`

Endpoint `/api/cameras/:id/ptz` memanggil `cam.ptz.continuousMove(...)`, padahal di versi
library `onvif` yang terpasang **`cam.ptz` itu `undefined`** — method ada langsung di objek
`cam`. Diverifikasi di container: `cam ptz-ish fns: getPresets,gotoPreset,setPreset,
removePreset,getNodes,ptzSendAuxiliaryCommand,...`. Ini sumber error **`socket hang up`**
yang user lihat. 4 pemanggilan dibetulkan → `cam.continuousMove/stop/getPresets/gotoPreset`.

Bonus fix di endpoint yang sama: **port ONVIF salah** — dulu `parsed.port || 80` dari URL
RTSP (=554). ONVIF itu HTTP, bukan RTSP. Sekarang pakai `camera.onvif_port || 80`.

### 4. Deteksi PTZ — endpoint baru

- **`GET /api/cameras/:id/ptz-capability`** (`requireApiAuth`): connect ONVIF →
  `getCapabilities` → **`getNodes`**, cek ada `supportedPTZSpaces` dengan ruang gerak nyata
  (`continuousPanTiltVelocitySpace` / `absolutePanTiltPositionSpace` /
  `relativePanTiltTranslationSpace`). Hasil di-cache ke kolom `ptz_enabled`.
- **`POST /api/cameras/:id/ptz-override`** (`requireApiAuth`): body `{hasPtz}`.
  Konvensi `ptz_enabled`: **`1`** = punya PTZ, **`0`** = tidak (hasil auto-probe),
  **`-1`** = **user menandai manual "tidak punya PTZ"** → probe otomatis **tidak boleh
  menimpanya** (dicek di awal handler capability).
- Route `/admin/ptz` kini ikut SELECT `ptz_enabled, onvif_port` (dulu cuma `id,nama,lokasi,url_rtsp`).
- **UI**: banner status + panel D-pad otomatis `opacity-40 pointer-events-none` kalau tak
  didukung; tombol **"Kamera ini sebenarnya tidak punya PTZ"** muncul hanya saat hasil
  ditandai `unreliable`.

### ⚠️ Temuan lapangan: ONVIF kamera clone TIDAK bisa dipercaya

Investigasi kamera **37 (Teras Selatan, `10.10.111.8`)** yang user pastikan **tidak punya
PTZ**. Yang dijawab kamera:

| Ditanya | Jawaban kamera | Kenyataan |
|---|---|---|
| Punya service PTZ? | Ya, `http://10.10.111.8:80/onvif/Ptz` | **Bohong** |
| `getNodes`? | Ya — pan/tilt/zoom velocity space, **`maximumNumberOfPresets: 128`**, `homeSupported: true` | **Bohong** |
| `continuousMove({x:0.5})`? | **`SUCCESS`** | Tidak bergerak |
| `stop()`? | **`SUCCESS`** | — |

**Kesimpulan: tidak ada query jarak jauh yang bisa membuktikan kamera ini tak punya PTZ.**
Firmware clone mengklaim kapabilitas penuh di semua lapisan DAN meng-ACK perintah gerak yang
tak bisa dieksekusi. Deteksi otomatis 100% akurat **mustahil** di kamera begini.

Konsekuensi desain (penting kalau nanti menyentuh fitur ini):
- Cek `capabilities.PTZ.XAddr` saja **jelas tidak cukup** — itu versi pertama yang bikin
  false positive (kamera 37/38/39 sempat ter-flag `ptz_enabled=1`, sudah di-reset ke 0).
- `getNodes` lebih ketat & menangkap kamera fixed yang jujur, tapi **tetap tertipu** kamera 37.
- Karena itu hasil probe diperlakukan sebagai **klaim**, bukan kebenaran: banner **amber**
  "Kamera melaporkan dukungan PTZ (klaim firmware)" — sengaja **bukan hijau meyakinkan** —
  + jalur override manual (`-1`) yang permanen.
- Status lapangan: **semua 5 kamera terdaftar (37–41) tidak ada yang punya PTZ.**

---

## 2026-07-21 — Hapus fitur mati + UI mobile (Plan #10, live di prod)

Plan: [../plan/done/10-hapus-fitur-mati.md](../plan/done/10-hapus-fitur-mati.md).
Commit `4363385` (hapus) & `022a2e5` (mobile). **-1.785 baris.**

**Dihapus** — AI Engine, APK CCTV, P2P Stream. Ketiganya tidak dipakai dan menyisakan
indikator yang selalu mati. Ikut terbuang: `database_ai.js` (yatim, tak pernah
di-`require`), view `admin_apk_cctv.ejs` + `admin_p2p_stream.ejs`, route terkait, dan
key permission `admin_ai`/`admin_ai_report`.
**DVR/NVR (`admin/dvr-apk`) tidak disentuh** — nama mirip, fitur berbeda, masih aktif.

**UI mobile** (`app/views/index.ejs`) — tombol audio & multi-view 2×2 di HP.

### Fakta kode yang ditemukan sepanjang sesi ini

- **Overlay kontrol live view dulu pakai `opacity-0 group-hover:opacity-100`.** Di HP
  tidak ada hover → **seluruh overlay** (screenshot, fullscreen, audio) tak terjangkau
  sentuh, bukan cuma audio. Sekarang `opacity-100 lg:opacity-0 lg:group-hover:opacity-100`.
  Kalau menambah tombol baru di overlay, ikuti pola ini.
- **`toggleCameraSelection()` dulu mengunci HP ke 1 kamera** (`selectedCameraIds = [id]`,
  selalu ganti). Ini penghalang sebenarnya multi-view di HP — memunculkan tombol preset
  saja tidak cukup. Sekarang: tap = ganti saat 1 view, tap = tambah saat grid >1 tile,
  **dibatasi `MOBILE_MAX_TILES = 4`** dengan perilaku geser (`shift()` yang terlama).
- **Batas 4 tile di HP wajib ditegakkan di EMPAT tempat**, bukan satu. Versi pertama
  cuma menyentuh `toggleCameraSelection` dan langsung bocor di prod:
  `toggleCameraSelection()` (tap), `setGridPreset()` (tombol preset),
  `selectDefaultCameras()` (dulu `slice(0,16)` — login pertama dari HP = 16 tile), dan
  `loadState()` (state dari sesi desktop bisa berisi 9–16 id). Kalau menambah jalur baru
  yang mengisi `selectedCameraIds`, batasi juga di sana.
- **Ukuran tombol overlay: `p-1.5` + ikon `w-3` (~24px), seragam di semua grid.** Sempat
  dinaikkan ke 32px demi target sentuh, tapi di tile 2×2 (~187px) jadi dominan dan user
  menolaknya. Target sentuh mengalah pada proporsi tile.
- **`setGridPreset()` tidak memanggil `renderMobileList()` maupun `saveState()`.** Di
  desktop tak terasa; di HP bikin highlight daftar basi & pilihan tak tersimpan. Sudah
  ditambah, plus `scrollTo` ke atas (tombol preset ada **di dalam** daftar kamera).
- **CSS grid tidak pernah dikunci per perangkat** — `.grid-4`/`.grid-9`/`.grid-16`
  berlaku di semua lebar layar. Satu-satunya media query cuma `aspect-ratio` `.grid-1`
  di ≥1024px. Pembatasan multi-view murni ada di JS, bukan CSS.
- Preset HP sengaja **hanya 1×1 & 2×2**. 3×3/4×4 desktop-only: di 390px tile jadi
  ~123px/~91px, dan tiap tile = satu HLS decode — HP kelas menengah kehabisan decoder
  hardware (sejalan dengan alasan transcode H.265→H.264, lihat
  [06-temuan-lapangan.md](06-temuan-lapangan.md)).
- **Permission tidak dirender dari DB.** `getLevelPermissions()` memakai
  `{...defaults, ...stored}` (`services/levelPermissions.js:257`) sehingga key yang
  dihapus dari default **tetap tertinggal** di kolom JSON DB. Tapi tak berdampak: UI
  merender dari `menuGroups` yang **hardcode** di `views/admin_permissions.ejs:77`.
  Konsekuensi: menghapus permission cukup di kode, **tidak perlu migrasi DB** — tapi
  menambah permission baru **wajib** menyentuh `menuGroups`, kalau tidak takkan muncul.

## Fakta penting kode (temuan audit)

- Recording MediaMTX = global on/off (`config.recording.enabled` + jendela waktu) **DAN**
  per-kamera via `enable_recording` (Plan #1 selesai). Per-kamera hanya bisa *mematikan*
  rekam; tak bisa merekam di luar window global.
- Untuk RTSP, app bikin 2 path: `cam_X_input` (source dari kamera) + `cam_X` (hasil
  transcode/copy H.264 via `smart_transcode.sh`). Yang ditonton browser = `cam_X`.
- **PTZ**: library `onvif` versi terpasang **tidak punya `cam.ptz`** — panggil
  `cam.continuousMove/stop/getPresets/gotoPreset` langsung. Port ONVIF = `onvif_port`
  (HTTP, biasanya 80), **bukan** port dari URL RTSP (554). Kolom `ptz_enabled`:
  `1`=punya, `0`=tidak (auto), `-1`=override manual user (probe tak boleh menimpa).
  Klaim ONVIF kamera clone tak bisa dipercaya — lihat sesi 2026-07-21 di atas.
- Level akses: `umum` < `member` < `vip` < `vvip`/`pemerintahan` < `admin`.
  Isolasi per-user: **semua kamera non-`umum` owner-scoped** (default). Detail di
  [05-membership-isolasi-user.md](05-membership-isolasi-user.md). UI level diciutkan ke umum/member/admin.
