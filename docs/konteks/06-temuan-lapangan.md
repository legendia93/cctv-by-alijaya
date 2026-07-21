# Konteks — Temuan Lapangan (hardware & perilaku nyata)

Fakta yang **sudah terjadi & terverifikasi** saat menguji dengan perangkat asli. Bukan
rencana. Tujuannya: sesi berikutnya tak mengulang diagnosis yang sama, dan tak salah
menuduh bug aplikasi padahal masalahnya di perangkat.

---

## NVR SSN `10.10.111.254` — H.265 tak bisa didecode

Bulk-add sempat sukses membuat 16 entry CH1–CH16 dan MediaMTX **menerima koneksi** RTSP
(`cam_X_input` status RDY), tapi **stream hitam**.

ffmpeg & MediaMTX sama-sama gagal decode H.265-nya:

```
width=0
PPS id out of range
SPS SubLayerLevelPresentFlag not supported
```

Terjadi di main-stream (`Channels/X01`) **maupun** sub-stream (`Channels/X02`). UDP diblok.

**Kesimpulan: masalah encoder/paketisasi RTP di NVR, BUKAN bug aplikasi.** Dugaan kuat
"H.265+" / Smart Codec aktif. Solusi di sisi perangkat: di web NVR, set Video Encoding
per-channel ke **H.264** dan matikan H.265+. Fitur bulk-add siap dipakai ulang begitu
stream-nya benar.

**Tindakan yang sudah diambil:** ke-16 entry (id 42–57) **dihapus** (DB + path MediaMTX)
atas permintaan user. Tersisa 5 kamera lama yang bekerja (id 37–41).

> Catatan: kolom id kamera `AUTOINCREMENT` (`sqlite_sequence.cameras` = 57) → kamera baru
> mulai dari **id 58**, tidak mengisi celah 42–57. Ini normal, tidak diubah.

---

## PTZ — kamera clone mengklaim kapabilitas palsu (sesi 2026-07-21)

**Semua 5 kamera terdaftar (37–41) tidak ada yang punya PTZ.** Fitur PTZ praktis belum
terpakai sampai ada kamera PTZ sungguhan.

⚠️ **Kamera 37 (`10.10.111.8`) mengklaim PTZ palsu.** ONVIF `getNodes` melaporkan 128
preset & velocity space, `continuousMove` membalas `SUCCESS` — tapi **fisik tidak
bergerak sama sekali**.

**Konsekuensi:** deteksi kapabilitas PTZ otomatis **mustahil 100% akurat** untuk kamera
clone. Karena itu disediakan override manual (`ptz_enabled = -1`) untuk menandai "tidak
punya PTZ" meski ONVIF mengklaim punya.

**Yang belum terverifikasi:** jalur `move` / `stop` / `zoom` sudah dibetulkan secara kode
dan endpoint membalas SUCCESS, tapi **gerakan fisik belum pernah diuji** — tidak ada
hardware PTZ-nya. Perlu uji ulang saat kamera PTZ asli tersedia.

Perbaikan kode halaman `/admin/ptz` (stream URL `cam_<id>`, endpoint PTZ, `cam.ptz` →
`cam.*`, port ONVIF): [03-patch-app-clone.md](03-patch-app-clone.md).

---

## Storage E:\ terisi 129 GB oleh Docker, bukan rekaman

Saat menyelidiki beda angka storage, terbukti: setelah **seluruh** 62 file rekaman
terhapus, disk **tetap 58%**. Ruang itu dipakai **instalasi Docker sendiri** di E:\ —
normal untuk mesin dev, bukan tanda disk bermasalah.

Ini yang mengungkap cacat desain auto-cleanup (mengukur seluruh disk tapi hanya bisa
menghapus rekaman). Detail + pengamannya:
[08-ui-kamera-dvr-storage.md](08-ui-kamera-dvr-storage.md) §6.

---

## Kamera dev yang bekerja

5 kamera (id 37–41), semua RTSP kecuali id 40 (embed YouTube). Per akhir sesi 2026-07-21
**semuanya `enable_recording = 0`** (live-only, tidak merekam).

Kamera Avaro/Tuya `10.10.111.4:8554` diketahui baik untuk uji deteksi stream — lihat
memory `detect-streams-feature`.
