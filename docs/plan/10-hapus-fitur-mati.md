# Plan — Bersih-bersih Fitur Mati + Tombol Audio Mobile

**Status: semua bagian (1–5) ✅ dikoding 2026-07-21. Verifikasi di HP belum dilakukan.**

Hasil eksekusi bagian 1–3: **1.780 baris terhapus**, 3 file dibuang
(`database_ai.js`, `admin_apk_cctv.ejs`, `admin_p2p_stream.ejs`). DVR/NVR tidak
tersentuh. Grep verifikasi bersih total.

Dua temuan di luar plan awal:
- Dashboard punya **kartu bento "AI Engine"** (baris 79–88) yang tidak tercatat di plan.
  Ikut dihapus; grid diturunkan `lg:grid-cols-4` → `lg:grid-cols-3` supaya baris tidak timpang.
- Dashboard mem-fetch **`/api/ai-proxy/health`** yang **tidak pernah ada route-nya** di
  `index.js` — jadi selama ini 404 tiap muat halaman. Ikut dibuang.

Permission `admin_ai` & `admin_ai_report` sudah hilang dari `services/levelPermissions.js`
(12 baris default + 2 entri katalog). **Belum ada migrasi DB** — lihat catatan di bawah.

Hasil bagian 4–5 (mobile), semua di `app/views/index.ejs`:
- Overlay kontrol: `opacity-0` diganti `opacity-100 lg:opacity-0 lg:group-hover:opacity-100`
  — di HP selalu tampil, di desktop perilaku hover **tidak berubah**. Ketiga tombol
  dinaikkan dari `p-1.5`+`w-3` (≈24px) ke `p-2`+`w-4` (≈32px) memenuhi target sentuh.
- `toggleAudio()` + `setAudioIcon()` baru: ikon speaker on/off, set `volume = 1` saat
  unmute, dan **mute semua tile lain** supaya hanya satu kamera bersuara.
- Penguncian `toggleCameraSelection` dilonggarkan jadi
  `isMobile && selectedCameraIds.length <= 1` — tap = ganti saat 1 view, tap = tambah
  saat grid >1 tile.
- Preset **1×1 & 2×2** untuk HP ditaruh di atas kotak cari `#mobile-list-container`
  (wadah terpisah — header desktop baris 340 tidak disentuh).

Satu temuan di luar plan: `setGridPreset()` **tidak memanggil `renderMobileList()`
maupun `saveState()`**, jadi di HP highlight daftar kamera jadi basi dan pilihan tidak
tersimpan. Ditambahkan, plus `scrollTo` ke atas — tanpa itu tombol preset ada di dalam
daftar kamera dan grid yang berubah tidak terlihat sama sekali.

Dua jenis pekerjaan:
- **Bagian 1–3 (hapus)**: buang AI Engine, APK, dan P2P — tiga fitur yang **tidak dipakai
  dan tidak akan dipakai**, supaya UI tidak menampilkan indikator yang selalu mati dan
  kode tidak menyimpan jalur buntu. (~1.650 baris)
- **Bagian 4–5 (perbaikan UI mobile)**: tombol toggle audio yang terjangkau tanpa
  fullscreen, dan preset multi-view (1×1 / 2×2) di HP.

Latar belakang AI: dependensi `@tensorflow/*` sudah dibuang saat perampingan image
(lihat [../konteks/12-analisa-ukuran-image.md](../konteks/12-analisa-ukuran-image.md)),
tapi **sisa UI & backend-nya masih ada**. Ini menuntaskannya.

---

## ⚠️ Jangan tersandung: DVR/NVR ≠ APK

`admin/dvr-apk` (view `admin_dvr_apk.ejs`, 1020 baris) adalah **halaman DVR/NVR yang
AKTIF dipakai** untuk bulk add channel — **JANGAN DIHAPUS**. Namanya mirip `apk-cctv`
tapi fitur yang berbeda. Yang dihapus hanya `apk-cctv` dan `p2p-stream`.

Cek cepat sebelum menyentuh apa pun: di
[../../app/views/partials/admin_sidebar.ejs](../../app/views/partials/admin_sidebar.ejs)
baris 66, menu `dvr_apk` **berada di luar** blok komentar — itu yang aktif.

---

## Bagian 1 — AI Engine

Indikator "AI Engine" di dashboard selalu memanggil `127.0.0.1:9090` yang tidak pernah
ada, jadi hasilnya selalu null/offline.

- [x] **[../../app/index.js](../../app/index.js)**
  - Hapus blok `// AI Engine health` (~baris 5777–5793): HTTP GET ke
    `http://127.0.0.1:9090/api/ai/health`. Service itu tidak pernah ada di image.
  - Hapus field `ai_engine: null` (~baris 5715) dari objek health.
- [x] **[../../app/views/admin_dashboard.ejs](../../app/views/admin_dashboard.ejs)**
  - Hapus kartu `AI Engine` (~baris 85, `<div class="n-label mb-2">AI Engine</div>`)
    beserta wadahnya.
  - Hapus entri `['sys-ai','AI Engine']` dari array (~baris 146).
  - Hapus entri `['srv-ai','AI Engine']` dari array (~baris 174).
  - Hapus blok `if (s.ai_engine && ...)` (~baris 237–238) yang mengisi `sys-ai`.
  - ⚠️ Cek layout grid setelah kartu dihapus — kolom bisa jadi timpang.
- [x] **[../../app/database_ai.js](../../app/database_ai.js)** — **hapus file** (172 baris).
  Yatim piatu: tak pernah di-`require` dari mana pun, jadi `migrateAiTables()` tak pernah
  jalan dan tabel `ai_speed_records`/`ai_vehicle_counts`/`ai_detection_zones` **tak pernah
  dibuat**. Menghapusnya tidak menyentuh DB.
- [x] **Permission**: hapus key `admin_ai` & `admin_ai_report` dari default permission.
  Sekarang tersimpan di kolom JSON `level_permissions.permissions` (bukan kolom terpisah).
  Cari di [../../app/database.js](../../app/database.js) / services tempat default JSON
  dibuat. **Data lama di DB tidak otomatis bersih** — kalau Permission Manager masih
  menampilkan baris AI, perlu migrasi kecil yang menghapus dua key itu dari JSON tiap baris.

## Bagian 2 — APK CCTV

- [x] **[../../app/views/admin_apk_cctv.ejs](../../app/views/admin_apk_cctv.ejs)** — hapus file (879 baris).
- [x] **[../../app/index.js](../../app/index.js)** — hapus route `GET /admin/apk-cctv` (~baris 2029–2040).
- [x] **[../../app/views/partials/admin_sidebar.ejs](../../app/views/partials/admin_sidebar.ejs)**
      — hapus baris menu APK (baris 63) yang ada di dalam blok komentar.

## Bagian 3 — P2P Stream

- [x] **[../../app/views/admin_p2p_stream.ejs](../../app/views/admin_p2p_stream.ejs)** — hapus file (603 baris).
- [x] **[../../app/index.js](../../app/index.js)**
  - Hapus route `GET /admin/p2p-stream` (~baris 2042–2050).
  - Hapus route `GET /api/p2p/stream-status` (~baris 2052+).
- [x] **sidebar** — hapus baris menu P2P (baris 64).
- [x] Setelah baris 63 & 64 hilang, **blok komentar `<% /* %> ... <% */ %>` (baris 59–65)
      jadi kosong → hapus sekalian** beserta komentar penjelasnya, supaya tidak
      meninggalkan komentar yang menunjuk ke sesuatu yang sudah tak ada.

---

## Verifikasi setelah eksekusi

- [ ] `grep -rn "ai_engine\|admin_ai\|apk-cctv\|apk_cctv\|p2p" app/ --include="*.js" --include="*.ejs" | grep -v node_modules`
      → hanya boleh menyisakan `dvr_apk` (fitur aktif) dan referensi di `install.sh`
      (skrip bare-metal warisan, di luar cakupan).
- [ ] Dashboard admin dibuka → tidak ada kartu "AI Engine", layout grid tidak timpang.
- [ ] Sidebar → menu APK & P2P hilang, **DVR/NVR MASIH ADA**.
- [ ] Buka `/admin/apk-cctv` & `/admin/p2p-stream` → 404 (route hilang, wajar).
- [ ] Permission Manager dibuka → tidak ada baris AI.
- [ ] `docker compose -f docker-compose.lookna.yml up -d --build` → container healthy,
      `GET /login` 200.

---

# Bagian 4 — Tombol audio di live view HP (BUKAN penghapusan)

Ditambahkan atas laporan user 2026-07-21: dibuka dari HP, live tampil normal tapi
**audio tidak bisa dinyalakan tanpa masuk fullscreen dulu**.

> Default audio **mute tetap dipertahankan** — user menyatakan itu sudah tepat.
> Yang diminta: tombol toggle audio bisa dijangkau **tanpa** fullscreen.

## Akar masalah (sudah ditelusuri)

Dua hal bertumpuk di [../../app/views/index.ejs](../../app/views/index.ejs):

1. **Baris 815** — tile live memakai `<video ... playsinline autoplay muted>`
   **tanpa atribut `controls`**. Jadi tidak ada UI audio sama sekali. Saat fullscreen,
   yang muncul adalah kontrol native browser — itulah kenapa audio hanya bisa diakses
   dari sana.
2. **Baris 827** — overlay tombol (Screenshot, Fullscreen) memakai
   `opacity-0 group-hover:opacity-100`. **Di HP tidak ada hover**, jadi seluruh overlay
   praktis tak terjangkau di sentuh, bukan hanya audio.

Artinya ini sekaligus memperbaiki pola overlay yang memang tidak ramah sentuh.

## Yang dikerjakan

- [x] Tambah **tombol toggle audio** di overlay kontrol (baris 827), sebelah
      Screenshot & Fullscreen. Ikon speaker on/off yang berganti sesuai state.
- [x] Handler `toggleAudio(videoId)`: balik `video.muted`, perbarui ikon.
      **Penting:** saat unmute, set `video.volume = 1` juga — sebagian browser mobile
      menyisakan volume 0 setelah autoplay-muted.
- [x] **Hanya satu kamera bersuara pada satu waktu**: saat satu tile di-unmute,
      mute semua tile lain. Tanpa ini, membuka 4–16 kamera bisa berbunyi bersamaan.
- [x] Buat overlay **terjangkau di layar sentuh**. Pilih salah satu:
      - **(a)** Selalu tampil di viewport kecil: `opacity-100 lg:opacity-0
        lg:group-hover:opacity-100` — paling sederhana, konsisten dengan breakpoint `lg`
        yang sudah dipakai di baris 827.
      - **(b)** Tap pada tile menampilkan overlay beberapa detik lalu menghilang
        (pola pemutar video umum). Lebih rapi tapi perlu state & timer per tile.
      Rekomendasi: **(a)** dulu — perbaikan langsung terasa, risiko rendah.
- [x] Pastikan tombol cukup besar untuk jari: target sentuh **≥ 32×32 px**
      (sekarang `p-1.5` + ikon `w-3 h-3` ≈ 24 px, terlalu kecil untuk HP).

## Catatan teknis

- Kamera **embed** (baris 810/814) memakai iframe/`<video controls>` sendiri — di luar
  cakupan, jangan disentuh. Blok overlay memang sudah dibatasi `${!isEmbed ? ... : ''}`.
- Popup preview (baris 1213/1224) juga `muted` — pertimbangkan tombol serupa kalau
  user memintanya, tapi **tidak termasuk permintaan sekarang**.
- Audio hanya terdengar kalau **stream-nya memang membawa audio**. Beberapa kamera
  RTSP tidak mengirim audio, atau MediaMTX tidak mem-passthrough track-nya. Kalau
  setelah unmute tetap senyap, cek dulu apakah track audio benar-benar ada
  (`cam_<id>/audio2_stream.m3u8` muncul di log) sebelum memvonis bug UI.

## Verifikasi

- [ ] Buka live dari **HP** (bukan emulator desktop): tombol audio terlihat tanpa
      fullscreen, dan bisa ditekan dengan jari.
- [ ] Tekan → audio menyala; tekan lagi → mati. Ikon berubah sesuai state.
- [ ] Unmute kamera lain → kamera sebelumnya otomatis mute.
- [ ] Di desktop perilaku hover lama **tidak berubah**.
- [ ] Kamera embed tidak terpengaruh.

---

# Bagian 5 — Multi-view (2×2, 3×3) di HP

Pertanyaan user 2026-07-21: mungkinkah versi HP punya multi-view seperti di web?

## Jawaban: BISA — CSS-nya sudah siap, tapi ada DUA penghalang di kode

User melaporkan: *"di hp gak ada pilihan grid view, hanya bisa 1 view"* — benar, dan
setelah ditelusuri [../../app/views/index.ejs](../../app/views/index.ejs) penyebabnya
ada **dua**, bukan satu. Ini penting: memperbaiki salah satu saja menghasilkan
perilaku yang membingungkan.

| # | Penghalang | Lokasi | Efek |
|---|---|---|---|
| 1 | Kontrol preset disembunyikan | baris 340 `<div class="hidden lg:flex ...">` | Tombol 1×1/2×2/3×3/4×4 (baris 348–351) tak terlihat di bawah 1024px |
| 2 | **Pemilihan dikunci 1 kamera** | **baris 756–759** | **Penghalang sebenarnya** |

Penghalang #2 di `toggleCameraSelection()`:

```js
const isMobile = window.innerWidth < 1024;
if (isMobile) {
    selectedCameraIds = [String(id)];   // SELALU ganti, tak pernah tambah
    window.scrollTo({ top: 0, behavior: 'smooth' });
} else { /* push/splice — multi-select */ }
```

Di HP, tap kamera **selalu mengganti seluruh pilihan dengan satu kamera**. Jadi walau
tombol preset dimunculkan, tap kamera berikutnya langsung mengembalikan ke 1 view.

**Kabar baiknya:** CSS grid **tidak** dikunci. Kelas `.grid-4` / `.grid-9` / `.grid-16`
(baris 85–89) berlaku di semua ukuran layar; satu-satunya media query (baris 91–93)
cuma mengatur `aspect-ratio` `.grid-1` di ≥1024px. Fungsi `setGridPreset()` (baris 2297)
juga bersih tanpa pembatas perangkat. Jadi begitu dua penghalang di atas dibuka,
multi-view langsung jalan.

## Yang dikerjakan

- [x] **Longgarkan penguncian di baris 756–759.** Jangan hapus total — perilaku
      "tap = ganti" itu masuk akal saat sedang di mode 1 view (user ingin ganti kamera,
      bukan menumpuk). Ubah jadi: **multi-select hanya saat grid sedang >1 tile**,
      mis. `if (isMobile && selectedCameraIds.length <= 1)` tetap ganti; selain itu
      push/splice seperti desktop.
- [x] Pertahankan `window.scrollTo` saat mode 1 view (membantu di layar sempit),
      tapi **jangan** dijalankan saat menambah kamera ke grid — loncatan scroll saat
      menyusun 2×2 terasa mengganggu.

## Pertimbangan — kenapa jangan asal ditampilkan semua

Ini alasan sah kenapa dulu disembunyikan:

| Preset | Lebar tile di HP 390px | Layak? |
|---|---|---|
| 1×1 | ~390 px | ✅ jelas |
| 2×2 | ~187 px | ✅ masih terbaca |
| 3×3 | ~123 px | ⚠️ wajah/plat tak terbaca |
| 4×4 | ~91 px | ❌ praktis tak berguna |

Beban teknis lebih menentukan lagi: **tiap tile = satu HLS decode**. 9–16 stream
serentak di HP kelas menengah berarti panas, baterai terkuras, dan seringnya
**stream gagal main** karena batas decoder hardware (banyak HP hanya sanggup 4–8
decode aktif). Sudah terbukti relevan di proyek ini — transcode H.265→H.264 memang
sengaja dilakukan karena keterbatasan decoder klien
(lihat [../konteks/06-temuan-lapangan.md](../konteks/06-temuan-lapangan.md)).

## Rekomendasi

**Tampilkan 1×1 dan 2×2 saja di HP; 3×3 & 4×4 tetap desktop.** Itu memberi manfaat
nyata tanpa menjanjikan sesuatu yang perangkatnya tak sanggup.

- [x] Buat wadah preset terpisah untuk mobile (jangan sekadar hapus `hidden lg:flex`
      dari baris 340 — di dalamnya ada tab Live/Peta yang punya penempatan sendiri
      di layout mobile; membukanya bisa merusak header).
- [x] Isi dengan **1×1 dan 2×2** saja, panggil `setGridPreset(1)` / `setGridPreset(4)`
      yang sudah ada.
- [x] Letakkan di dekat kontrol mobile yang sudah ada supaya tak menambah baris baru
      pada header yang sempit.
- [x] Target sentuh ≥ 32×32 px (`text-[10px]` + `px-3 py-1.5` sekarang terlalu kecil).
- [ ] **Landscape**: saat HP diputar, 3×3 mulai masuk akal. Opsional — munculkan 3×3
      lewat `@media (orientation: landscape)`. Kerjakan hanya kalau user memintanya.

## Verifikasi

- [ ] Buka live dari HP → tombol 1×1 & 2×2 terlihat dan bisa ditekan.
- [ ] Tekan 2×2 → 4 kamera tampil, **semuanya benar-benar memutar** (bukan spinner
      menggantung). Kalau ada yang gagal, itu batas decoder — turunkan ke 1×1.
- [ ] **Tap kamera lain saat mode 2×2 → TIDAK balik ke 1 view** (ini bukti penghalang #2
      benar-benar teratasi; kalau masih reset, perbaikan baris 756 belum kena).
- [ ] Tap kamera saat mode 1×1 → tetap berganti seperti biasa (perilaku lama terjaga).
- [ ] Amati panas & baterai setelah ~5 menit di 2×2.
- [ ] Desktop tidak berubah sama sekali.

---

## Catatan

- Bagian 1–3 adalah **pekerjaan hapus**, tidak menambah fitur. Risiko utama = kehapus
  terlalu banyak (terutama DVR/NVR). Kerjakan bertahap per bagian, uji di antara.
- Bagian 4 & 5 **menambah/mengubah** UI — kerjakan terpisah dari bagian hapus supaya
  kalau ada masalah jelas penyebabnya.
- Bagian 4 & 5 saling bersinggungan (sama-sama menyentuh overlay & header live view di
  mobile) — **kerjakan berurutan, jangan paralel**, agar tidak bentrok di file yang sama.
- File `app/services/activityLogger.js.BACKUP*` menyebut "AI engine operations" —
  itu **file backup**, bukan kode aktif. Abaikan (atau bersihkan terpisah; ada beberapa
  `.BACKUP`/`.1` yang menumpuk di `app/` dan `app/services/`).
- `app/install.sh` menyebut AI Engine di 2 tempat — skrip instalasi bare-metal warisan
  repo asli, tidak dipakai jalur Docker. Biarkan.
- Deploy: **user yang menjalankan `scripts/deploy.sh`**, naikkan versi (`v1.1.0` → `v1.1.1`).
