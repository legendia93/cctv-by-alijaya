# Konteks — Dev Workflow

## Kredensial dev (data/config.json)

- Admin login: **`admin`** / **`DevPassw0rd@2026x`**
- URL: http://localhost:3003 (login di `/login`, customer di `/user/login`)
- session_secret dev: sudah di-set (random). `mediamtx.host = 127.0.0.1`.

> Ini kredensial DEV. Untuk prod WAJIB ganti password + session_secret.

## Menjalankan

### Mode DEV (auto-reload, dipakai selama development)
```bash
cd /e/Project/cctv
docker compose -f docker-compose.lookna.yml -f docker-compose.dev.yml up -d
```
- Bind-mount `./app` → edit langsung terbaca container, **TANPA rebuild image**.
- **Edit `.ejs` / view → langsung tampil** di request berikutnya (cukup refresh browser).
  Tidak perlu restart. Ini karena `view cache` dimatikan saat `DEV_MODE=1`
  (lihat [index.js `app.set('view engine'...)`](../../app/index.js) — blok `if DEV_MODE`).
- **Edit `.js` (logika server) → paling pasti `docker restart lookna`** (~beberapa
  detik, bukan rebuild). Nodemon dijalankan (dgn `--legacy-watch`) tapi polling lewat
  bind-mount `E:\` di Docker Desktop **Windows tidak andal** — jangan mengandalkannya.
- MediaMTX tetap jalan saat Node restart.
- **Rebuild image HANYA perlu** kalau ubah `package.json` (dep npm baru) atau `Dockerfile.lookna`.

> **Akar masalah historis:** dulu edit `.ejs` "tidak muncul" karena **EJS view cache
> di memori server** (bukan cache browser / service worker). Sudah diperbaiki via
> `app.set('view cache', false)` saat dev.

### Mode produksi
```bash
docker compose -f docker-compose.lookna.yml up -d
```

## Perintah harian

```bash
# status
docker compose -f docker-compose.lookna.yml ps

# logs (ikuti)
docker logs -f lookna
# atau
docker compose -f docker-compose.lookna.yml logs -f

# restart (mis. setelah ubah config.json / mediamtx.single.yml — bukan auto-reload)
docker compose -f docker-compose.lookna.yml restart

# stop (data di ./data aman)
docker compose -f docker-compose.lookna.yml down

# rebuild setelah ubah Dockerfile/deps
docker compose -f docker-compose.lookna.yml build
```

## Cek state dari dalam container

```bash
# daftar kamera di DB
docker exec lookna sh -c "sqlite3 /app/cameras.db 'SELECT id,nama,url_rtsp,level FROM cameras;'"

# status path/stream di MediaMTX (ready = online)
docker exec lookna curl -s http://127.0.0.1:9123/v3/paths/list | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s);d.items.forEach(p=>console.log(p.name,'ready:',p.ready,p.tracks||''))})"

# cek reachability kamera dari container (ganti IP)
docker exec lookna node -e "const s=require('net').connect(554,'10.10.111.8');s.setTimeout(3000);s.on('connect',()=>{console.log('REACHABLE');s.destroy()});s.on('timeout',()=>{console.log('TIMEOUT');process.exit()});s.on('error',e=>console.log(e.code))"

# log transcode per kamera
docker exec lookna sh -c "cat stream_logs/transcode_cam_37_input.log | tail"
```

## Uji cepat via HTTP

```bash
# login admin -> ambil cookie
CK=$(curl -s -i -X POST http://localhost:3003/login -H "Content-Type: application/x-www-form-urlencoded" --data "username=admin&password=DevPassw0rd@2026x" | grep -i set-cookie | sed 's/Set-Cookie: //I' | cut -d';' -f1)

# tambah kamera RTSP (otomatis register ke MediaMTX + transcode)
curl -s -X POST http://localhost:3003/api/cameras -H "Cookie: $CK" -H "Content-Type: application/json" \
  -d '{"nama":"Test","lokasi":"X","url_rtsp":"rtsp://IP/live/ch0","is_public":1}'

# cek playback HLS (200 = ok)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3003/cam_37/index.m3u8
```

## Catatan penting saat edit

- **Insert kamera langsung ke DB via sqlite CLI TIDAK mendaftarkan ke MediaMTX.**
  Selalu tambah lewat UI atau `POST /api/cameras` supaya `registerCamera()` jalan.
- Perubahan `config.json` / `mediamtx.single.yml` butuh **restart** (`docker restart lookna`).
- Perubahan **`.ejs`/view** → langsung tampil (view cache off), cukup refresh browser.
- Perubahan **`.js`** → `docker restart lookna` (nodemon Windows tidak andal).
