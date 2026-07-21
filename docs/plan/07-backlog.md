# Plan — Backlog (belum dikerjakan)

Kumpulan hal yang **belum dieksekusi**: ditunda, dibahas tapi belum dikerjakan, atau
opsional. Dipindah ke sini dari `konteks/06-todo-next.md` (2026-07-21) agar folder
`konteks/` murni berisi *apa yang sudah terjadi*, bukan rencana.

Temuan lapangan yang dulu tercampur di file itu dipindah ke
[../konteks/06-temuan-lapangan.md](../konteks/06-temuan-lapangan.md).

---

## Ditunda (user bilang "nanti aja")

- [ ] **Seragamkan `config.docker.json`** → default `mediamtx.host = "127.0.0.1"` untuk
  1 container (sekarang templatenya masih placeholder; `data/config.json` sudah benar).

## Fitur

- [ ] **Dual-stream** untuk hemat CPU — kamera main-stream H.265 (rekam) + sub-stream
  H.264 (live view tanpa transcode). Perlu dukungan di form + logika path.
  Plan lengkap: [03-dual-stream.md](03-dual-stream.md) (Opsi A disarankan).
  **Ditunda user — kerjakan terakhir.**

## PTZ (lanjutan)

- [ ] **Uji dengan kamera PTZ asli.** Jalur `move/stop/zoom` sudah dibetulkan dan endpoint
  membalas SUCCESS, tapi gerakan fisik belum pernah terverifikasi (tak ada hardware).
  Konteks: [../konteks/06-temuan-lapangan.md](../konteks/06-temuan-lapangan.md).
- [ ] Opsional: tombol override manual saat ini hanya untuk arah "tidak punya PTZ". Kalau
  ada kamera PTZ yang gagal terdeteksi (mis. ONVIF ditutup), tambahkan arah sebaliknya
  (`hasPtz: true` → `ptz_enabled=1`) di UI — **endpoint sudah mendukung**.

## Membership lanjutan (untuk produk jualan matang)

- [ ] Payment gateway otomatis (Midtrans/Xendit).
- [ ] Kuota storage / retensi **per pelanggan** (sekarang global).
- [ ] Notifikasi WA/email reminder perpanjangan sebelum `active_until` habis
  (enforcement expiry sendiri sudah ada — C2).

## Isolasi per-user (opsional)

- [ ] **Validasi bind**: kalau level=`member` tapi `owner_id` kosong saat simpan kamera →
  peringatkan admin. Sekarang tersimpan diam-diam dan kamera jadi tak tampil ke siapa pun.
  Sudah ditawarkan ke user, belum dikerjakan.
- [ ] **Force owned default**: `selectDefaultCameras()` hanya jalan saat state kosong.
  Kalau user mau kamera miliknya SELALU terbuka tiap login (abaikan localStorage lama),
  ubah `loadState`. Belum diminta.

## Sisa poles UI

- [ ] `user_account.ejs` (akun pelanggan) belum dirombak per-komponen ke `.n-card`/`.n-num`.
  Sudah include `head_theme` → via compat tampil netral. Bukan darurat.
- [ ] Bersihkan string kelas `bg-emerald-*` per-halaman manajemen saat menyentuhnya
  (`admin_customers/alerts/streaming/finance/…`) — compat menutupi, bukan darurat.

## Kebersihan / prod-readiness

- [ ] Hapus kamera lama `cam_6`/`cam_7` (192.168.8.x, tak reachable) kalau tak dipakai.
- [ ] Untuk PROD: ganti password admin + `session_secret`, set `behind_https_proxy: true`
  + `public_base_url`/`public_hls_url`, taruh di belakang Nginx/Cloudflare.
- [ ] `express-session` pakai MemoryStore (warning "not for production") — pertimbangkan
  store persisten kalau scaling.
- [ ] Commit perubahan `app/` ke branch lokal biar aman dari ketimpa `git pull` upstream
  (belum dilakukan — user belum minta commit).

---

## Catatan risiko (berlaku terus)

- Patch kita ada di `app/` (repo clone). `git pull` upstream bisa konflik — semua
  perubahan tercatat di [../konteks/03-patch-app-clone.md](../konteks/03-patch-app-clone.md).
- Deployment aktif = 1 container (`*.allinone.yml` + `*.dev.yml`). File 2-container lama
  = arsip, jangan dipakai.
