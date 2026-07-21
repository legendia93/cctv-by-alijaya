# Konteks — Streaming & Transcode

## Alur (per kamera RTSP)

```
Kamera RTSP  ──pull──►  MediaMTX path cam_X_input  (codec asli, mis. H.265)
                              │ runOnReady
                              ▼
                    smart_transcode.sh (ffmpeg)
                       ├─ input H.264  → COPY (CPU ~0)
                       └─ input H.265  → transcode ke H.264 (pakai CPU)
                              │ push
                              ▼
                    MediaMTX path cam_X  (H.264, browser-ready)
                              │ HLS :8856
                              ▼
              Node proxy /cam_X/*  (same-origin :3003)  ──►  browser (hls.js)
```

- `smart_transcode.sh` di-trigger MediaMTX via `runOnReady: ./smart_transcode.sh`.
- Script deteksi codec pakai `ffprobe`; H.264 → copy, lain → transcode ke H.264.
- Setting transcode (resolusi, bitrate, fps) dibaca dari `config.json` bagian `recording`.

## Kenapa perlu transcode

Browser (Chrome/Firefox) **tidak** support H.265/HEVC untuk HLS. Kamera CCTV banyak
pakai H.265 (lebih hemat ~40-50% storage/bandwidth vs H.264). Jadi:
- Live view di browser BUTUH H.264 → transcode.
- Trade-off: transcode H.265→H.264 pakai CPU (berat kalau banyak kamera).
- Alternatif hemat CPU: kamera dual-stream (main H.265 utk rekam, sub H.264 utk live) —
  BELUM diimplementasi, lihat [../plan/07-backlog.md](../plan/07-backlog.md).

## Path & config MediaMTX (1 container)

- `recordPath` = `/app/recordings/%path/...` (app push via API, dari `__dirname`).
- `data/recordings` di-mount ke `/app/recordings`.
- App override `pathDefaults` via API saat start (record, runOnReady, retention).
- `mediamtx.single.yml` menyediakan `authInternalUsers` (any, permissive) — WAJIB
  karena MediaMTX 1.16.x default wajib auth API, sedangkan app panggil tanpa kredensial.

## Cek status stream

`ready: true` = stream online. Cek:
```bash
docker exec lookna curl -s http://127.0.0.1:9123/v3/paths/list | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s);d.items.forEach(p=>console.log(p.name,'ready:',p.ready,p.tracks||''))})"
```
- `cam_X_input ready:true [H265,...]` = kamera ke-pull, codec asli.
- `cam_X ready:true [H264,...]` = transcode/copy jalan, browser bisa nonton.
- Kalau `cam_X` tetap `false` padahal input ready → cek `stream_logs/transcode_cam_X_input.log`.

## Kamera dev yang terpasang (per akhir sesi)

| ID | Nama | RTSP | Codec | Mode |
|----|------|------|-------|------|
| 37 | SSN-01 | rtsp://10.10.111.8/live/ch0 | H.264 | copy |
| 38 | SSN-02 | rtsp://10.10.111.3/live/ch0 | H.264 | copy |
| 39 | Kedai | rtsp://10.10.111.7/live/ch0 | **H.265** | transcode→H.264 |

Semua `level=umum` (publik). Semua ONLINE & HLS playback 200 saat sesi ditutup.
Jaringan: kamera di subnet `10.10.111.x`, reachable dari container (host `10.10.17.7`).

## Gotcha yang sudah ketemu

- CRLF di `smart_transcode.sh` bikin transcode gagal total (script "not found"). Fixed.
- Kamera lama `cam_6`/`cam_7` (192.168.8.x) OFFLINE — memang tak reachable dari dev ini,
  bukan bug. Bisa dihapus kalau mau.
- Insert kamera via sqlite CLI ≠ register ke MediaMTX. Pakai UI / `POST /api/cameras`.
