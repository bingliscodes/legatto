# Legatto — Guitarist Practice Tool

**Live at [legatto.live](https://legatto.live).**

A practice tool for guitarists built on AI stem separation. Upload a song, separate it into
stems (drums, bass, vocals, other, **guitar**, piano), and practice in an in-browser
multitrack player — mute the guitar to play along, or solo it to learn the part. Plus
pitch-preserving **slow-down with A–B looping** and a **revisitable track library**.

See **[DECISIONS.md](DECISIONS.md)** for the architecture decisions, the reasoning behind
them, and the hard-won deployment lessons.

## How it works

Upload → the file lands in object storage → a background job runs GPU stem separation →
the six stems are stored → the browser loads them into a Web Audio multitrack player
(per-stem mute / solo / volume, slow-down, looping).

## Stack

- **Frontend:** React + TypeScript + Vite; client-side Web Audio (SoundTouchJS for
  pitch-preserving time-stretch)
- **Backend:** FastAPI (Python 3.12); **Celery** on Redis for background jobs
- **Separation:** `htdemucs_6s` (Demucs, 6 stems incl. guitar), run on **RunPod serverless
  GPU** (handler image in `backend/runpod_worker/`)
- **Storage:** DO Spaces (S3-compatible) for audio; Postgres for track metadata
- **Swappable seams:** separation and storage sit behind `Separator` / `Storage` interfaces
  — local disk + on-device MPS for dev, RunPod + Spaces for prod (selected by config)

## Deployment

Self-hosted on a DigitalOcean droplet via Docker Compose (nginx + api + worker + Postgres +
Redis + certbot), HTTPS via Let's Encrypt (auto-renewing). **CI/CD:** a push to `main`
triggers GitHub Actions to build the images, push them to GHCR, and deploy to the droplet;
schema migrations apply automatically on deploy. Full detail in
[DECISIONS.md](DECISIONS.md) (D11).

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
and `storage_backend=local` in `backend/.env`.

> **Compose layout:** `compose.yaml` (base) + `compose.override.yaml` (local, auto-applied) +
> `compose.prod.yaml` (prod, explicit `-f`). Local `docker compose up` builds the images;
> prod pulls them from GHCR. See DECISIONS.md.
