# Legatto — Guitarist Practice Tool

**Live at [legatto.live](https://legatto.live)** — a pre-separated demo track is already
sitting in every new visitor's library, so you can try the player immediately without an
account, an upload, or a wait.

A practice tool for guitarists built on AI stem separation. Upload a song, split it into six
stems (drums, bass, vocals, **guitar**, piano, other), and practice against it in an
in-browser multitrack player.

Stem separation itself is a commodity — the product is the **practice workflow** layered on
top of it:

- **Per-stem mute / solo / volume** — mute the guitar and play the part yourself, or solo it
  to learn what's actually being played.
- **Pitch-preserving slow-down + A–B looping** — loop the four bars you keep fluffing at 70%
  speed, without the chipmunk effect.
- **Speed trainer** — set a tempo ladder (say 50% → 100% in 5% steps, 3 reps each) and the
  loop walks its own tempo up as you get it clean. Levels are pre-stretched one ahead and
  scheduled on the Web Audio clock, so the step-ups are seamless.
- **Revisitable track library** — separated tracks persist and follow you back, no account
  and no re-uploading.

See **[DECISIONS.md](DECISIONS.md)** for the architecture decisions, the reasoning and
alternatives behind each one, and the hard-won deployment lessons.

## How it works

Upload → the file lands in object storage → a Celery job runs GPU stem separation on RunPod
→ the six stems are compressed to mp3 and stored → the browser fetches them via presigned
URLs straight from object storage and loads them into a Web Audio multitrack player
(per-stem mute / solo / volume, slow-down, looping, speed trainer).

Separation takes ~1 minute of GPU time for a typical song, so it never runs inline in a
request — the upload returns immediately and the track row moves `processing → completed`.

## Stack

- **Frontend:** React + TypeScript + Vite; client-side Web Audio (SoundTouchJS for
  pitch-preserving time-stretch)
- **Backend:** FastAPI (Python 3.12); **Celery** on Redis for background jobs
- **Separation:** `htdemucs_6s` (Demucs, 6 stems incl. a dedicated guitar stem), run on
  **RunPod serverless GPU** (handler image in `backend/runpod_worker/`)
- **Storage:** DO Spaces (S3-compatible) for audio; Postgres for track metadata
- **Swappable seams:** separation and storage sit behind `Separator` / `Storage` interfaces
  — local disk + on-device MPS for dev, RunPod + Spaces for prod (selected by config)

## Users

Anonymous persistent identity — **no login**. The server mints a `users` row on first visit
and stores the id in a signed cookie (Starlette `SessionMiddleware`); tracks carry a
`user_id` FK and every route is gated by a `get_current_user_id` dependency, so libraries are
isolated per user without an auth flow. The tradeoff — a cleared cookie is a new user — is a
deliberate one for a tool nobody should have to sign up for. OAuth is a two-way door and
stays deferred. See DECISIONS.md (D12).

## Abuse & cost controls

GPU inference is the cost center — an unguarded upload endpoint is somebody else's compute
budget. The upload path is therefore layered:

- **nginx** caps the request body at 100M
- **Validation:** extension allowlist, a `mutagen` header-read duration guard, and filename
  sanitization — all *before* anything touches storage or the queue
- **Per-IP rate limit:** custom Redis fixed-window counters (hourly + daily), with the real
  client IP recovered behind nginx via uvicorn's `--forwarded-allow-ips`
- **Global daily cap:** a Redis calendar-day bucket that 503s once the day's separation
  budget is spent — a hard ceiling on the bill, independent of how many IPs show up

Limits live in `backend/app/config.py`. The cap is grounded in measured RunPod economics
(~$0.015 per 4-minute song; cold start is a fixed per-job cost, not a per-second one) rather
than guessed. See DECISIONS.md (D14).

## Deployment

Self-hosted on a DigitalOcean droplet via Docker Compose (nginx + api + worker + Postgres +
Redis + certbot), HTTPS via Let's Encrypt (auto-renewing). **CI/CD:** a push to `main`
triggers GitHub Actions to build the images, push them to GHCR, and deploy to the droplet;
schema migrations apply automatically on deploy. The droplet is operated as a non-root user
with root SSH disabled. Full detail in [DECISIONS.md](DECISIONS.md) (D11).

**Backups:** a nightly cron on the droplet runs `scripts/backup-db.sh` — `pg_dump` of
Postgres → a private DO Spaces bucket, keeping the last 7. Recovery is
`scripts/restore-db.sh`, a safe swap-by-rename into the live DB (restore off to the side,
typed confirmation, then an atomic rename cutover that preserves the old DB as a rollback
point). Both have been rehearsed against production. See DECISIONS.md (D11 step 5).

**Usage metrics:** daily active users are tracked with a Redis set per UTC day (`SADD` on
identity resolution, `SCARD` to count), snapshotted nightly into a `daily_active_users` table
by a Celery beat task — unique counts with **zero per-request database writes**. See
DECISIONS.md (D15).

## Credits

The demo track is used under a Creative Commons licence:

> **"Holistic Thought (Pensamiento Holístico) – Progressive Post-Metal"** by
> **David J. Barrios**, from the
> [Free Music Archive](https://freemusicarchive.org/music/david-j-barrios/single/holistic-thought-pensamiento-holistico-progressive-post-metal/),
> licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
> **Modified:** separated into six instrument stems for use as a demo.

## Local development

**Prerequisites:** Python 3.12+, Node 20+, Docker (Desktop running).

Set up the env files (never committed):

```sh
cp backend/.env.example backend/.env    # app config; for prod-mode separation add Spaces + RunPod creds
```

Create a root `.env` (next to `compose.yaml`) with the local Postgres credentials:

```sh
POSTGRES_USER=legatto
POSTGRES_PASSWORD=<anything>
POSTGRES_DB=legatto
```

> The root `.env` feeds Compose interpolation; `backend/.env` configures the app. Their
> Postgres credentials must agree, or you'll get an auth failure. Postgres only honors
> `POSTGRES_*` on **first init of an empty volume** — a stale `pgdata` volume keeps the old
> credentials, so `docker compose down -v` (local only — it destroys data) to re-mint.

### Option A — full stack in containers (simplest)

```sh
docker compose up -d --build      # base + local override → whole stack over HTTP
```

Open <http://localhost>. This uses the slim image, so separation runs via RunPod — set
`separator=runpod` + `storage_backend=s3` and the Spaces/RunPod creds in `backend/.env`.

### Option B — native dev loop (hot reload, on-device separation)

Run Postgres + Redis (reachable on `localhost`), then the app natively for fast feedback:

```sh
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-local.txt   # -local adds demucs/torch for on-device separation
make dev        # uvicorn --reload   (:8000)
make worker     # celery worker      (separate terminal)

cd ../frontend
npm install && npm run dev            # Vite dev server (:5173)
```

Open <http://localhost:5173>. For fully local, no-cloud separation, set `separator=local`
and `storage_backend=local` in `backend/.env`. On-device (CPU/MPS) separation takes ~5–10
minutes per song versus ~1 minute on the GPU — fine for wiring work, painful for anything
audio-related.

> **Compose layout:** `compose.yaml` (base) + `compose.override.yaml` (local, auto-applied) +
> `compose.prod.yaml` (prod, explicit `-f`). Local `docker compose up` builds the images;
> prod pulls them from GHCR. `nginx.conf` / `nginx.prod.conf` are bind-mounted, so config
> changes reload without a rebuild — code and `dist` changes need one. See DECISIONS.md.
