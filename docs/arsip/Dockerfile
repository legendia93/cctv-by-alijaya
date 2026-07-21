# ==========================================================================
# CCTV Monitoring - Node.js application image
# Base: Node 20 (matches README requirement "Node.js v20.x")
# Includes: ffmpeg (transcoding / YouTube stream), build tools for sqlite3
# MediaMTX runs as a SEPARATE container (see docker-compose.yml)
#
# Build context is the repo ROOT; application source lives in ./app
# ==========================================================================
FROM node:20-bookworm-slim

# System deps:
# - ffmpeg  : used by youtube_stream.js / smart transcode (falls back to system ffmpeg)
# - python3, make, g++ : native build of sqlite3 / bcrypt if prebuilt binaries missing
# - sqlite3 : handy CLI for maintenance / debugging inside container
# - tzdata  : app sets TZ=Asia/Jakarta
# - curl    : healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        python3 \
        make \
        g++ \
        sqlite3 \
        tzdata \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV TZ=Asia/Jakarta
ENV NODE_ENV=production

WORKDIR /app

# Install dependencies first (better layer caching)
COPY app/package.json app/package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund || npm install --production --no-audit --no-fund

# Copy the rest of the application source
COPY app/ ./

# Persisted at runtime via volumes (see docker-compose): recordings, db, config, bot auth
RUN mkdir -p recordings uploads bukti_tf

# Web dashboard port (RTSP/HLS/API are served by the mediamtx container)
EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:3003/login > /dev/null || exit 1

CMD ["node", "index.js"]
