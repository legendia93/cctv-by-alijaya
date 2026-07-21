# Analisa Database Engine

Dokumen ini menganalisa engine database yang dipakai aplikasi CCTV Monitoring dan
memberi rekomendasi engine yang paling tepat untuk kebutuhannya.

---

## 1. Engine saat ini: SQLite

Aplikasi memakai **SQLite** lewat driver `sqlite3` (node-sqlite3), bukan ORM.

**Bukti dari kode:**

| Aspek | Temuan |
|-------|--------|
| Driver | `require('sqlite3').verbose()` di [`app/database.js`](../app/database.js) |
| File DB | `cameras.db` (+ `-wal`, `-shm`) — single-file, embedded |
| Jumlah query | **± 241** pemanggilan `db.run / db.get / db.all / db.each / db.prepare` |
| File yang menyentuh DB | 7 file: `index.js`, `database.js`, `database_ai.js`, `youtube_stream.js`, `check_cameras.js`, `update_rtsp_tools.js`, `_update_cam6.js` |
| Jumlah tabel | **18** (cameras, recordings, users, transactions, billing_packages, bank_accounts, incident_reports, activity_logs, alert_rules, alert_history, alert_settings, system_kv, _migrations, + 5 tabel `ai_*`) |
| Abstraksi | **Tidak ada ORM / query builder.** Semua raw SQL dengan callback API `sqlite3` |

**Tuning yang sudah diterapkan** (`database.js`) — mode performa "serius" untuk SQLite:

```sql
PRAGMA journal_mode=WAL;      -- tulis-baca konkuren
PRAGMA synchronous=NORMAL;    -- seimbang aman vs cepat
PRAGMA cache_size=-8000;      -- cache 8 MB
PRAGMA busy_timeout=5000;     -- tunggu 5 dtk sebelum "database is locked"
PRAGMA temp_store=MEMORY;
PRAGMA mmap_size=30000000;    -- memory-mapped I/O
```

---

## 2. Karakteristik beban kerja aplikasi

Untuk memilih DB, yang menentukan adalah **pola akses**, bukan sekadar selera.

- **Volume data kecil.** Data inti = daftar kamera, user, transaksi billing. Puluhan
  s/d ratusan baris, bukan jutaan.
- **Tabel paling sering ditulis:**
  - `recordings` — 1 baris per segmen rekaman (default 1 file / 60 menit / kamera).
    Untuk 10 kamera ≈ 10 insert/jam. **Sangat rendah.**
  - `activity_logs` — audit trail aksi admin. Sporadis, mengikuti aktivitas manusia.
  - `alert_history` — saat ada alert. Sporadis.
- **Baca jauh lebih banyak dari tulis** (dashboard, listing kamera, listing rekaman).
- **Concurrency penulis rendah.** Satu proses Node (single writer). Tidak ada
  ratusan koneksi paralel — SQLite WAL sudah cukup menangani baca-konkuren.
- **Deployment target:** Raspberry Pi / Orange Pi / VPS kecil (RAM 1–2 GB, ARM/x86).
  Diinstal via `install.sh`, satu box, satu proses.

**Kesimpulan pola:** ini beban **kecil, single-node, read-heavy, low write-concurrency** —
justru "sweet spot" SQLite.

---

## 3. Rekomendasi

### ✅ Tetap pakai SQLite (rekomendasi utama untuk mode single-node)

Alasan:

1. **Cocok dengan beban kerja.** Volume kecil + single writer = tidak ada masalah
   yang diselesaikan Postgres/MySQL yang tidak sudah diselesaikan SQLite di sini.
2. **Nol biaya operasional.** Tidak ada server DB terpisah untuk di-deploy, di-tuning,
   di-backup, atau di-patch keamanan. Backup = copy 1 file (`cp cameras.db ...`).
3. **Ideal untuk target hardware.** Di Raspberry Pi 1–2 GB RAM, menjalankan
   Postgres/MySQL memakan RAM yang lebih baik dipakai untuk transcoding video.
4. **Cocok dengan Docker.** DB = satu file yang di-mount sebagai volume
   (`./data/cameras.db`). Tidak perlu container DB ketiga.
5. **Ganti engine = pekerjaan besar.** ± 241 query raw callback-style harus ditulis
   ulang (mis. `lastID`/`this.changes` → `RETURNING id`, `datetime('now')` → sintaks
   lain, `INSERT OR REPLACE` → `ON CONFLICT`). Risiko bug tinggi, manfaat ~nol untuk
   skala saat ini.

**Yang perlu dipastikan di Docker:** file `cameras.db` (+ WAL/SHM) berada di **volume
yang persist**, dan idealnya di filesystem lokal container (bukan network share) agar
locking WAL berperilaku benar. Compose sudah mem-mount `./data/cameras.db`.

### 🟡 Pertimbangkan PostgreSQL — hanya jika salah satu ini terjadi

Pindah ke Postgres **hanya** kalau kebutuhan berubah menjadi:

- **Multi-instance / horizontal scaling.** Menjalankan >1 proses/replica app yang
  menulis ke DB yang sama (SQLite tidak dirancang untuk banyak penulis lintas proses/host).
- **Fitur `ai_*` dipakai serius.** Tabel `ai_events`, `ai_speed_records`,
  `ai_vehicle_counts` bisa tumbuh cepat (deteksi objek real-time = ribuan baris/hari
  per kamera). Kalau ini aktif dan berjalan lama, Postgres lebih nyaman untuk query
  analitik + retensi besar.
- **Butuh akses DB dari layanan lain** (BI, reporting terpisah, dashboard eksternal)
  secara konkuren.

Kalau ke Postgres: bungkus akses DB di satu modul (`database.js`) di balik antarmuka
`get/all/run` yang mengembalikan Promise, lalu migrasikan pemanggil. Pertimbangkan
query-builder ringan (Knex) atau ORM (Prisma/Sequelize) untuk mengurangi SQL manual.

### ❌ MySQL/MariaDB — tidak disarankan khusus

Tidak ada alasan kuat memilih MySQL di atas Postgres untuk app ini. Kalau memang harus
pindah ke DB client-server, Postgres lebih unggul untuk tipe data & query analitik
(JSON, window function untuk laporan) yang relevan dengan fitur billing/alert/AI.

---

## 4. Ringkasan keputusan

| Skenario | Engine | Alasan singkat |
|----------|--------|----------------|
| **Sekarang (single box, ≤ puluhan kamera, AI off/ringan)** | **SQLite** ✅ | Pas beban, nol ops, backup 1 file, cocok Pi & Docker |
| Multi-instance / HA / scaling horizontal | PostgreSQL | SQLite bukan untuk banyak penulis lintas proses |
| Fitur AI (deteksi objek) dipakai penuh & jangka panjang | PostgreSQL | Volume `ai_*` tumbuh cepat, butuh analitik |
| Ingin DB client-server tapi bukan karena scaling | Tetap SQLite | Belum ada masalah nyata yang dijawabnya |

**Keputusan untuk versi Docker ini: tetap SQLite**, file DB dipersist lewat volume
`./data/cameras.db`. Jalur upgrade ke Postgres dicatat di atas bila skala bertambah.
