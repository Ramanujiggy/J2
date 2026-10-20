# Dockerfile — Move Library v2 (mig 028) needs ffmpeg on the runtime PATH
# for the transcoding worker (src/workers/transcodeWorker.ts).
#
# Why this exists: Nixpacks' aptPkgs / nixPkgs setup phase didn't reliably
# propagate the ffmpeg binary into the runtime image on Railway's builder.
# After two redeploy attempts (aptPkgs → nixPkgs), the worker still booted
# with ffmpeg missing. A plain Dockerfile uses a single layer chain with
# explicit RUN steps — what we install is what ends up on PATH.
#
# Railway behavior: when this file exists at the service root, Railway
# auto-detects it and uses Docker instead of Nixpacks. The [deploy]
# startCommand in railway.toml still applies (matches CMD here, so net
# behavior is identical); the [build] buildCommand is bypassed because
# the RUN steps below drive the build.

FROM node:20-slim

# ffmpeg from Debian's apt repos. Decodes HEVC out of the box for
# iPhone-recorded camera clips. The cleanup pattern (apt-get clean +
# rm -rf /var/lib/apt/lists) keeps the image lean — package lists don't
# need to ship to the runtime container.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first so the layer cache only invalidates when package.json
# / package-lock.json change. Source-only changes reuse the cached deps
# layer and finish builds in well under a minute.
# .npmrc tells onnxruntime-node (pose worker) to skip its CUDA download.
COPY package*.json .npmrc ./
RUN npm ci --include=dev

# Copy source + build the TypeScript output to dist/. Mirrors the
# buildCommand from railway.toml so behavior is identical to the prior
# Nixpacks path, just with ffmpeg actually present.
COPY . .
RUN npm run build

# Railway provides PORT at runtime; default for local `docker run`.
ENV PORT=5000
EXPOSE 5000

# Start the API server. Same as railway.toml's startCommand. The transcode
# worker is booted from src/server.ts after migrations run.
CMD ["npm", "run", "start"]
