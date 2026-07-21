#!/bin/bash
# Deploy CCTV ke server produksi (build → push registry → recreate container)
# Usage: ./scripts/deploy.sh <version>
# Example: ./scripts/deploy.sh v1.0.1
#
# Server 10.10.17.6 = VM di dalam TrueNAS 10.10.17.4.
# Rekaman ada di /mnt/cctv-data (NFS dari dataset SSN/VMs/cctv-data, quota 100 GiB).
#
# Server pertama kali? Jalankan dulu: ./scripts/bootstrap-prod.sh

set -u

VERSION=$1
REGISTRY="10.10.17.6:5000"
SERVER_USER="root"
SERVER_HOST="10.10.17.6"
SERVER_DIR="/opt/cctv"

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_COMPOSE="$SCRIPT_DIR/docker-compose.prod.yml"
VERSION_FILE="$SCRIPT_DIR/app/version.js"

if [ -z "${VERSION:-}" ]; then
  echo "Usage: ./scripts/deploy.sh <version>"
  echo "Example: ./scripts/deploy.sh v1.0.1"
  exit 1
fi

# Tag docker pakai "v", field versi pakai semver polos.
SEMVER="${VERSION#v}"

echo "============================================"
echo "  CCTV Deploy"
echo "  Version : $VERSION  ($SEMVER)"
echo "  Target  : $SERVER_HOST:$SERVER_DIR"
echo "============================================"

# --- [0/5] Sinkronkan versi ----------------------------------------------
echo ""
echo ">>> [0/5] Menulis versi ke app/version.js..."
cat > "$VERSION_FILE" <<EOF
// Versi aplikasi. Diisi otomatis oleh scripts/deploy.sh saat deploy.
// Jangan diedit manual — perubahan akan tertimpa saat deploy berikutnya.
module.exports = { APP_VERSION: '$SEMVER' };
EOF
echo "    app/version.js → $SEMVER"

# --- [1/5] Update tag di compose lokal -----------------------------------
echo ">>> [1/5] Update docker-compose.prod.yml → cctv-allinone:$VERSION..."
sed -i "s|image: localhost:5000/cctv-allinone:.*|image: localhost:5000/cctv-allinone:$VERSION|" "$LOCAL_COMPOSE"

# --- [2/5] Build ----------------------------------------------------------
echo ">>> [2/5] Building cctv-allinone:$VERSION..."
docker build -f "$SCRIPT_DIR/Dockerfile.allinone" -t "$REGISTRY/cctv-allinone:$VERSION" "$SCRIPT_DIR"
if [ $? -ne 0 ]; then echo "Build failed."; exit 1; fi

# --- [3/5] Push -----------------------------------------------------------
echo ">>> [3/5] Pushing ke registry..."
docker push "$REGISTRY/cctv-allinone:$VERSION"
if [ $? -ne 0 ]; then echo "Push failed."; exit 1; fi

# --- [4/5] Deploy ---------------------------------------------------------
# Pengaman sebelum menyentuh container: kalau NFS lepas, ffmpeg akan menulis ke
# folder kosong di dalam container dan rekaman hilang saat recreate berikutnya.
echo ">>> [4/5] Deploy ke server..."

# Kirim compose (sudah berisi tag $VERSION dari langkah [1/5]).
# compose LOKAL = sumber kebenaran; perubahan langsung di server akan tertimpa.
scp "$LOCAL_COMPOSE" "$SERVER_USER@$SERVER_HOST:$SERVER_DIR/docker-compose.yml"
if [ $? -ne 0 ]; then echo "Gagal mengirim compose."; exit 1; fi
echo "    docker-compose.yml terkirim"

ssh "$SERVER_USER@$SERVER_HOST" "
  set -e
  cd '$SERVER_DIR'

  if ! mountpoint -q /mnt/cctv-data; then
    echo 'ERROR: /mnt/cctv-data tidak ter-mount — deploy dibatalkan.'
    echo '       Jalankan: mount -a   lalu ulangi deploy.'
    exit 1
  fi

  if ! docker network inspect ssn_gateway >/dev/null 2>&1; then
    echo 'ERROR: network ssn_gateway tidak ada — deploy dibatalkan.'
    echo '       Buat dengan: docker network create ssn_gateway'
    exit 1
  fi

  docker compose pull app
  docker compose up -d --no-deps --force-recreate app
  echo '    container up: cctv-allinone:$VERSION'
"
if [ $? -ne 0 ]; then echo "Deploy failed."; exit 1; fi

# --- [5/5] Verifikasi -----------------------------------------------------
echo ""
echo ">>> [5/5] Verifikasi..."
sleep 5
ssh "$SERVER_USER@$SERVER_HOST" "
  docker ps --filter name=cctv-allinone --format '    {{.Names}}  {{.Status}}'
  echo '    --- storage rekaman ---'
  df -h /mnt/cctv-data | tail -1 | awk '{print \"    \"\$2\" total, \"\$3\" terpakai (\"\$5\")\"}'
  echo '    --- log terakhir ---'
  docker logs --tail 15 cctv-allinone 2>&1 | sed 's/^/    /'
"

echo ""
echo "============================================"
echo "  Selesai: cctv-allinone:$VERSION live."
echo "  Buka: http://$SERVER_HOST:3003   (versi tampil di bawah sidebar)"
echo ""
echo "  Commit version bump:"
echo "    git add app/version.js docker-compose.prod.yml"
echo "    git commit -m \"chore: bump version to $VERSION\""
echo "============================================"
