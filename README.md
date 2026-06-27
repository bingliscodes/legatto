# Guitarist Practice Tool

A practice tool for guitarists built on AI stem separation. Upload a song, separate it
into stems (drums, bass, vocals, other, **guitar**, piano), and practice in a multitrack
player — mute the guitar to play along, or solo it to learn the part.

See **[DECISIONS.md](DECISIONS.md)** for the architecture decisions, the reasoning behind
them, and the build plan.

## Stack

- **Backend:** FastAPI (Python)
- **Jobs:** RQ on Redis (background stem separation)
- **Separation:** `htdemucs_6s` (Demucs v4, 6 stems incl. guitar) — _added in Slice 2_
- **Data:** Postgres — _added when we need persisted metadata_
- **Frontend:** React + TypeScript + Web Audio — _Slice 3_

## Dev setup

**Prerequisites:** Python 3.12+, Node 20+, Docker (Desktop running).

Start infra (Redis):

```sh
docker compose up -d
```

Run the backend:

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Then open <http://localhost:8000/health> and the auto-generated docs at
<http://localhost:8000/docs>.
