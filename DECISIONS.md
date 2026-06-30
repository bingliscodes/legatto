# Decisions log

A running record of the choices made and **why**. Newest decisions at the bottom of each section. This is both a project artifact and a learning record — when future-me asks "why did I do it this way?", the answer lives here.

---

## Decided

### D1 — MVP scope: "Multitrack play-along"

**Date:** 2026-06-27

The MVP is a single end-to-end slice:

> Upload a song → background stem separation → in-browser multitrack player with per-stem **mute / solo**.

This delivers two real guitarist workflows immediately: **mute the guitar** to play along, **solo the guitar** to learn the exact part.

**Why this first:**

- It's the _spine_ every other candidate feature builds on (slow-down/loop, backing-track export, chord charts all assume "upload → separate → play stems").
- Building the spine first teaches the hard architecture (async jobs, storage, streaming audio) without also fighting DSP.
- **Slice 2** (planned, not committed) is **slow-down without pitch change + A–B looping** — that's where the daily-habit retention really locks in.

**Explicitly out of MVP:** accounts/auth, backing-track export, chord/key/tempo analysis, YouTube ingestion.

### D2 — Separation model: `htdemucs_6s` (default, swappable)

**Date:** 2026-06-27

Use the **6-source** Demucs model (drums, bass, vocals, other, **guitar**, **piano**) as the default.

**Why:**

- The brief originally named `htdemucs_ft`, but that produces only **4 stems** with **no dedicated guitar** — guitar is buried in "other" with keys/synths, so "isolate the guitar" can't work.
- `htdemucs_6s` has a real guitar stem. Trade-off: its guitar/piano separation is more experimental / lower fidelity and a bit slower. For a _guitar_ tool, an imperfect guitar stem beats a perfect "other".
- We will keep the model behind a swappable interface, so changing/upgrading the model later is a config change, not a rewrite.

### D3 — No user accounts in the MVP (but don't paint ourselves into a corner)

**Date:** 2026-06-27

North star is "public, multi-user eventually," but the MVP ships with **no auth** — anonymous sessions only.

**Why:**

- Auth is a large scope sink that teaches little about the interesting part of this app.
- Mitigation: design the data model so users are _additive later_ (e.g. a nullable `user_id` on the relevant tables), not a rewrite.

### D4 — YouTube ingestion: deferred

**Date:** 2026-06-27

Not in the MVP. File upload only to start.

**Why:** technically trivial (`yt-dlp`) but violates YouTube ToS (legally gray). Not worth coupling the core product to it. Revisit later as a clearly-flagged optional path.

### D5 — Stack

**Date:** 2026-06-27

| Layer             | Choice                 | Why                                                                                                                                                                                                         |
| ----------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend language  | **Python**             | The separation model is a Python library; running it in a Python worker avoids a cross-language boundary. (Effectively forced, not really a choice.)                                                        |
| Backend framework | **FastAPI**            | Modern, async, type-hinted, auto API docs, big community, gentle to learn.                                                                                                                                  |
| Frontend          | **React + TypeScript** | Most transferable skill + biggest ecosystem; TS catches mistakes while leveling up.                                                                                                                         |
| Data store        | **Postgres**           | Already comfortable with it; right for the multi-user future.                                                                                                                                               |
| Background jobs   | **RQ on Redis**        | A _task queue_ (not a streaming broker) is the right category for "run this slow job." RQ is the simplest real one — clearest way to learn the broker/worker/job model. Graduate to Celery later if wanted. |

**Note on the queue choice:** the explicit goal was to _learn async processing_, so we start with a real queue now rather than a Postgres-poll. The reusable principle we'll enforce: keep the **work** (load file → separate → write stems → mark done) in a plain function, separate from the **transport** (RQ/Redis). That keeps the work testable and the transport swappable.

### D6 — Reversible picks (made by Claude, easily changed)

**Date:** 2026-06-27

- **File storage (MVP):** local disk behind a thin `Storage` interface (`save / get / url`). Swap to S3-compatible later = new implementation, same interface.
- **Separation compute (MVP):** local on the M1 Max via PyTorch **MPS**, behind a `Separator` interface. Later that interface can call a cloud GPU. Keeps the whole build at $0.
- **Audio / time-stretch / looping:** **client-side** (Web Audio API). Per-stem mixing, mute/solo, looping, and (slice 2) time-stretch all live in the browser in real time. Server-side would mean re-rendering on every tweak.
- **Python env:** `venv` + `requirements.txt` (boring, transferable, no extra tooling to learn). Can upgrade to `uv` later.
- **DB access:** SQLAlchemy + Alembic (the conventional FastAPI pairing) — _tentative, confirm when we get there._

### D7 — Demucs model loading: lazy singleton in the worker

**Date:** 2026-06-27

The Demucs `Separator(model="htdemucs_6s", device="mps")` is expensive to construct — it loads hundreds of MB of weights, moves them onto the MPS device, and downloads them on the first run. We cache **one instance per worker process**, created **lazily on first use** (a module-level global behind a `get_separator()` helper), rather than constructing one per job or eagerly at import.

**Why a singleton (vs. per-job):** reuse avoids paying the multi-second load on every job — a ~20–30% tax on a ~15s inference. One load, many jobs.

**Why _lazy_, not eager module-level — this is the subtle part:** an eager top-level `separator = Separator(...)` in `tasks.py` runs at **import** time, and the **API process imports `tasks.py`** (to enqueue `stem_separator`). That would load the entire model into the web server — which never runs inference — wasting memory, slowing API startup, and coupling API boot to weight downloads succeeding. Lazy init keeps imports cheap; only the worker, on its first job, pays the load.

**Coupled constraints / caveats:**

- The cached instance lives for the worker's lifetime, which works precisely because we run a **non-forking `SimpleWorker`** (`rq worker --worker-class rq.SimpleWorker`). A model loaded in a forking parent doesn't survive `fork()` cleanly — GPU/MPS contexts especially. (This is also the fix for the macOS Objective-C `fork()` crash.)
- "Single instance" is **per process** — N worker processes = N model copies in memory, all contending for the one MPS device. Fine at MVP scale.
- Not safe to share across concurrent in-process jobs, but `SimpleWorker` runs one job at a time, so OK.
- Alternative considered: enqueue by string (`"app.tasks.stem_separator"`) so the API never imports `tasks.py` at all. The lazy singleton is the more general fix; noted for reference.

### D8 — Time-stretch (slow-down): SoundTouchJS

**Date:** 2026-06-29

For pitch-preserving slow-down (product Slice 2), use **SoundTouchJS** (WSOLA-based), not Web Audio's `playbackRate`.

**Why:**

- `playbackRate` resamples → it changes *pitch* along with speed (chipmunk effect). Unusable for learning a part.
- **Quality:** confirmed by ear — good enough from ~**0.5× up** on the real (already-separated) stems, which covers the practice range. The stem-separation artifacts are the weaker link in the chain anyway, so a higher-end stretcher's edge is partly masked.
- **Licensing was decisive.** Rejected **Rubber Band** despite its higher quality because it's **GPL / commercial dual-licensed** — copyleft conflicts with the "ship it eventually" goal (would force open-sourcing or a paid license). SoundTouch is **LGPL** (usable in a closed app). Tone.js (MIT) was the framework alternative but would mean rebuilding the hand-built audio engine.
- Keeps the existing raw Web Audio engine; SoundTouch slots in.

**Integration approach: offline pre-stretch.** Stretch each stem's buffer to the target tempo once, then play the stretched buffers through the existing `BufferSource → gain` graph. Keeps the existing shared-`when` sync and enables native `loopStart`/`loopEnd` for A–B looping. Trade-off: re-stretch (~1–2s) on tempo change (debounce it). Chosen over real-time `PitchShifter` nodes, which give instant tempo but would require re-solving 6-way sync and hand-rolling the loop.

**Rubber Band deferred (2026-06-29):** monetization/licensing future is undecided, so not taking on a GPL/commercial dependency now. Revisit only if stretch quality becomes a real user complaint.

### D9 — Track library (persistence): SQLAlchemy + Alembic, DB as durable source of truth, stems stay on disk

**Date:** 2026-06-30

After Slice 2, the next slice is a **revisitable track library**: upload adds a track to a persistent list, the list shows status, and clicking a finished track reloads its stems — no re-upload, no re-separation. (Out of v1: rename, delete, accounts.)

**DB access layer — confirmed SQLAlchemy + Alembic** (D6 was tentative). Over SQLModel (less boilerplate but thinner docs / rough edges) and raw SQL (no ORM but more boilerplate, less FastAPI-idiomatic). Reasoning: industry-standard FastAPI pairing, deepest ecosystem, most transferable, and Alembic migrations are worth learning. The single `tracks` table keeps the ORM curve gentle.

**The DB becomes the durable source of truth for track status.** Today nothing durable records which tracks exist: RQ status has a ~500s Redis TTL; the frontend holds only the current job in React. Consequences:

- The **worker writes status** (queued → finished/failed) to the DB on completion, instead of the API guessing "done" by globbing the stems dir.
- The **frontend lists/polls the DB** (`GET /tracks`, `GET /tracks/{id}`) instead of RQ. RQ stays purely the execution mechanism; the DB owns state. (The D5 "work vs transport" split paying off — the work now reports to a durable store.)

**Stems stay on local disk; S3 deferred to the deploy slice.** Disk already survives a refresh (only status was ephemeral); S3's value is durability across machines/restarts, which only matters on ephemeral/serverless compute (a hosting concern). Keeping the deferral cheap: the DB stores a **storage-agnostic reference** (`track_id`/key), never a filesystem path and never the bytes, and all I/O stays behind the `Storage` interface (D6). Then disk → S3 later is a new `Storage` impl + URL strategy (proxy or presigned), not a schema or API-contract change.

---

## Build approach

**Vertical slices, tracer-bullet first.** Build one thin end-to-end path before adding breadth.

- **Slice 1 — Tracer bullet (skeleton with a _stub_ separator):** upload → job row → RQ enqueue → worker runs a fake "separator" → writes placeholder stems to storage → status endpoint reports done. Prove the _plumbing_ works end-to-end **before** introducing the slow/heavy real model. (This is why we can defer installing `torch`/`demucs` to Slice 2 — keeps Slice 1 light and isolates debugging.)
- **Slice 2 — Real separation:** swap the stub for `htdemucs_6s` on MPS, behind the same `Separator` interface.
- **Slice 3 — The player:** React + Web Audio multitrack player with per-stem mute/solo and synced playback (the MVP payoff).

**Who writes what:** Claude scaffolds boilerplate (repo layout, dev infra, app bootstrap) and reviews. Ben writes the load-bearing logic (the upload/job/enqueue flow, the worker task, the storage & separator interfaces, the player audio logic).

---

## Pending (to decide next)

- ~~Confirm SQLAlchemy + Alembic vs raw SQL for DB access.~~ **Resolved (2026-06-30):** SQLAlchemy + Alembic — see D9.
- ~~Slice 2: confirm `htdemucs_6s` install path on Apple Silicon (torch + MPS).~~ **Resolved:** runs on MPS (~15s for a 64s track). Needs the `torchcodec` Python package **and** system `ffmpeg` — `torchaudio` 2.11 decodes audio via `torchcodec`, which links FFmpeg. (`ffmpeg` 8 worked despite torchcodec historically targeting 4–7.)
- Hosting/deployment target + monthly cost ceiling — deferred until we approach a real deploy.
