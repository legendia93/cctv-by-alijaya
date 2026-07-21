#!/bin/bash
# Siapkan server produksi CCTV — JALANKAN SEKALI SAJA, sebelum deploy pertama.
# Usage: ./scripts/bootstrap-prod.sh
#
# Yang dilakukan:
#   1. Cek mount NFS /mnt/cctv-data sudah ada
#   2. Buat /opt/cctv + struktur data/
#   3. Siapkan file SQLite kosong (WAL + SHM) — WAJIB, lihat catatan di bawah
#   4. Kirim config.json, mediamtx.single.yml, docker-compose.prod.yml
#   5. Generate VAPID keys + session secret
#
# TIDAK menimpa file yang sudah ada. Aman diulang.

set -u

SERVER_USER="root"
SERVER_HOST="10.10.17.6"
SERVER_DIR="/opt/cctv"
NFS_MOUNT="/mnt/cctv-data"

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "============================================"
echo "  CCTV Bootstrap Server Produksi"
echo "  Target : $SERVER_USER@$SERVER_HOST:$SERVER_DIR"
echo "  Rekaman: $NFS_MOUNT/recordings (quota 100 GiB)"
echo "============================================"
echo ""

# --- [1/5] Cek prasyarat di server ---------------------------------------
echo ">>> [1/5] Cek prasyarat di server..."
ssh "$SERVER_USER@$SERVER_HOST" "
  set -e
  command -v docker >/dev/null || { echo 'ERROR: docker tidak ada di server.'; exit 1; }

  # Network bersama (external) harus sudah ada — compose tidak membuatnya.
  if ! docker network inspect ssn_gateway >/dev/null 2>&1; then
    echo 'ERROR: network ssn_gateway belum ada.'
    echo '       Buat dengan: docker network create ssn_gateway'
    exit 1
  fi
  echo '    network ssn_gateway OK'

  if ! mountpoint -q '$NFS_MOUNT'; then
    echo \"ERROR: $NFS_MOUNT belum ter-mount.\"
    echo '       Pastikan entry NFS ada di /etc/fstab lalu: mount -a'
    exit 1
  fi

  # Uji tulis — NFS bisa ter-mount tapi read-only karena root squash.
  if ! touch '$NFS_MOUNT/.write-test' 2>/dev/null; then
    echo \"ERROR: $NFS_MOUNT tidak bisa ditulis.\"
    echo '       Cek Maproot User/Group = root di NFS share TrueNAS.'
    exit 1
  fi
  rm -f '$NFS_MOUNT/.write-test'

  echo \"    docker OK, $NFS_MOUNT ter-mount & bisa ditulis\"
  df -h '$NFS_MOUNT' | tail -1 | awk '{print \"    kapasitas: \"\$2\" (terpakai \"\$5\")\"}'
"
[ $? -ne 0 ] && { echo "Bootstrap dibatalkan."; exit 1; }

# --- [2/5] Struktur folder + file SQLite ---------------------------------
echo ""
echo ">>> [2/5] Menyiapkan struktur folder & file DB..."
# PENTING: cameras.db, -wal, -shm di-bind-mount SEBAGAI FILE di compose.
# Kalau file-nya belum ada, Docker akan membuatnya sebagai DIREKTORI dan
# SQLite gagal total. Karena itu harus di-touch lebih dulu.
ssh "$SERVER_USER@$SERVER_HOST" "
  set -e
  mkdir -p '$SERVER_DIR/data' '$NFS_MOUNT/recordings'
  cd '$SERVER_DIR'
  mkdir -p data/uploads data/bukti_tf data/baileys_auth_info

  for f in data/cameras.db data/cameras.db-wal data/cameras.db-shm; do
    [ -e \"\$f\" ] || : > \"\$f\"
  done
  [ -e data/subscriptions.json ] || echo '[]' > data/subscriptions.json

  echo '    struktur siap'
"
[ $? -ne 0 ] && { echo "Bootstrap gagal di tahap folder."; exit 1; }

# --- [3/5] Kirim file konfigurasi ----------------------------------------
echo ""
echo ">>> [3/5] Mengirim compose & mediamtx config..."
scp "$SCRIPT_DIR/docker-compose.prod.yml" "$SERVER_USER@$SERVER_HOST:$SERVER_DIR/docker-compose.yml" || exit 1
scp "$SCRIPT_DIR/mediamtx.single.yml"     "$SERVER_USER@$SERVER_HOST:$SERVER_DIR/mediamtx.single.yml" || exit 1
echo "    docker-compose.yml + mediamtx.single.yml terkirim"

# --- [4/5] config.json (JANGAN timpa kalau sudah ada) --------------------
echo ""
echo ">>> [4/5] Menyiapkan config.json..."
if ssh "$SERVER_USER@$SERVER_HOST" "[ -s '$SERVER_DIR/data/config.json' ]"; then
  echo "    config.json sudah ada — DILEWATI (berisi password & secret, tidak ditimpa)."
else
  scp "$SCRIPT_DIR/config.docker.json" "$SERVER_USER@$SERVER_HOST:$SERVER_DIR/data/config.json" || exit 1
  # Sesuaikan untuk all-in-one + storage NFS:
  #   mediamtx.host  -> 127.0.0.1 (satu container, bukan service terpisah)
  #   storage_path   -> /app/recordings (mount NFS ber-quota)
  #   session_secret -> acak
  ssh "$SERVER_USER@$SERVER_HOST" "
    cd '$SERVER_DIR/data'
    SECRET=\$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
    sed -i 's|\"host\": \"mediamtx\"|\"host\": \"127.0.0.1\"|' config.json
    sed -i \"s|\\\"session_secret\\\": \\\".*\\\"|\\\"session_secret\\\": \\\"\$SECRET\\\"|\" config.json
    grep -q '\"storage_path\"' config.json \
      && sed -i 's|\"storage_path\": \".*\"|\"storage_path\": \"/app/recordings\"|' config.json
    echo '    config.json dibuat (mediamtx.host=127.0.0.1, session_secret acak)'
  "
  echo ""
  echo "    !!! WAJIB: set password admin sebelum dipakai !!!"
  echo "    ssh $SERVER_USER@$SERVER_HOST 'nano $SERVER_DIR/data/config.json'"
  echo "    Ubah authentication.password (min 16 karakter)."
fi

# --- [5/5] VAPID keys (untuk push notification) --------------------------
echo ""
echo ">>> [5/5] Menyiapkan VAPID keys..."
if ssh "$SERVER_USER@$SERVER_HOST" "[ -s '$SERVER_DIR/data/vapid-keys.json' ]"; then
  echo "    vapid-keys.json sudah ada — DILEWATI."
else
  echo "    Belum ada. Dibuat setelah image tersedia (lihat perintah di bawah)."
  ssh "$SERVER_USER@$SERVER_HOST" "[ -e '$SERVER_DIR/data/vapid-keys.json' ] || echo '{}' > '$SERVER_DIR/data/vapid-keys.json'"
fi

echo ""
echo "============================================"
echo "  Bootstrap selesai."
echo ""
echo "  Langkah berikutnya:"
echo "    1. Set password admin di $SERVER_DIR/data/config.json"
echo "    2. Deploy:  ./scripts/deploy.sh v1.0.0"
echo "    3. Setelah image ada, generate VAPID (sekali saja):"
echo "       ssh $SERVER_USER@$SERVER_HOST \"docker exec cctv-allinone node -e \\\"const w=require('web-push');console.log(JSON.stringify(w.generateVAPIDKeys(),null,2))\\\" > $SERVER_DIR/data/vapid-keys.json && docker restart cctv-allinone\""
echo "============================================"
