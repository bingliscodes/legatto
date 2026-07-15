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

- `playbackRate` resamples → it changes _pitch_ along with speed (chipmunk effect). Unusable for learning a part.
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

### D10 — Dedup separation by content hash: split model into Track and Asset

**Date:** 2026-07-01

Split the model into Track (the user's reference, including a name, artist, uploader, and timestamp) and Asset (hash key, status, stems). The Track is the user's reference and the Asset is the computed product.

**Why:**

- Multiple Tracks can share one asset
- GPU/CPU stem separation is the most expensive part of the system. Hashing content is cheap and makes uploads idempotent.
- Later on I could opt to go from exact-hash to acoustic fingerprint without changing schema. Rejected fingerprinting now because it's fuzzy (false positives on live/remaster/different masters) and only really worth the complexity at larger scale.
- Chose to do the split now because it's cheap. No real data to migrate and retrofitting after real users exist involves moving files and backfilling hashes.

### D11 — Production deploy architecture: serverless GPU, Celery, self-hosted on a droplet

**Date:** 2026-07-01

Going **straight to a full production deploy** (no thin spike). Four calls, made deliberately — several trade extra up-front work for either a hard product requirement or a concrete learning goal (the project's whole point).

- **Compute — serverless GPU** (provider: **RunPod serverless**, locked 2026-07-02 — chosen over Modal for the deeper container/infra learning + lower per-second cost; RunPod serverless is _not_ k8s). CPU separation on a plain droplet is ~5–10 min/song; **minutes-long turnaround is an unacceptable product UX**, so we jump to on-demand GPU (pay-per-second, ~pennies/song, fast). This **overrides** the earlier "deploy CPU first and measure" plan — the latency bar is a firm requirement, not an unknown to be measured.
- **Object storage — S3 / DO Spaces (pulled forward from D9).** A serverless GPU is a _separate machine_ and can't touch the droplet's local disk, so input + stems must live in shared object storage. This turns the two D6/D9 seams real: a `Storage` impl (disk → Spaces) and a `Separator` impl (local demucs → remote GPU). No schema change — the DB already stores a storage-agnostic reference (D9).
- **Queue — RQ → Celery** (broker + result backend on Redis). Primary driver: **Celery is a key technology Ben wants to learn** (also the more production-standard choice). Contained by the D5 work-vs-transport split — the separation _work_ function is unchanged; only the transport swaps. (The `SimpleWorker` non-forking constraint from D7 was macOS-specific; irrelevant on Linux.)
- **Frontend — self-served off the droplet, not Vercel.** nginx serves the built SPA + reverse-proxies the API; TLS via Let's Encrypt. Deliberately hand-rolled: a PaaS abstracts away the serving / reverse-proxy / TLS / system-design concepts Ben wants to internalize.

**Deploy target:** DigitalOcean droplet running Docker Compose (nginx + FastAPI API + Celery worker + Redis + Postgres); CI/CD via GitHub Actions; custom domain + HTTPS.

**Build order (tracer-bullet — each step leaves a working system):**

1. **Local refactors** (on the Mac) ✅ — `Separator` seam, `Storage` seam, and RQ → Celery all done; local pipeline verified end-to-end through the Celery worker (`--pool=solo`).
2. **Serverless GPU + object storage** (driven from the Mac) ✅ — `S3Storage` (DO Spaces via boto3) + smoke-tested; RunPod worker image (`ghcr.io/bingliscodes/legatto-worker:v1`, public) deployed as a serverless endpoint, separates → stems in Spaces; `RunPodSeparator` client + wiring done; **end-to-end from the app verified (2026-07-03)** — all hops green: upload → input to Spaces → Celery → `RunPodSeparator.run_sync` → RunPod GPU handler → 6 stems back to Spaces → `list_stems` → proxy-stream → player. **Interfaces are key-based** — `Separator.separate(input_key, output_prefix)` and `Storage` keyed by string: `LocalSeparator`/`LocalStorage` resolve keys under `STORAGE_ROOT`; `RunPodSeparator`/`S3Storage` pass keys straight through. That's the seam that lets one code path target **local disk _or_ Spaces+RunPod** via config (`storage_backend` + `separator`, which move together). Handler is DB-free (compute only); the Celery task owns status.
3. **Containerize + droplet** ✅ _(2026-07-03) — LIVE at `https://legatto.live`._ Slim backend image (demucs lazy-imported so the prod image ships **no torch**; base `requirements.txt` vs dev-only `requirements-local.txt`), **one image serves both api + celery worker** (compose `command:` override), multi-stage frontend image (Node build stage → `nginx:alpine` serving the built SPA). `compose.prod.yaml` runs the six-service topology — **nginx (sole front door) + api + worker + redis + self-hosted Postgres 17 (named `pgdata` volume) + certbot** — on a **DO droplet** (4 GB regular, sfo3, matched to the Spaces region). Same-origin `/api` (**backend owns the prefix**; nginx `proxy_pass` pass-through; Vite dev proxy mirrors it); secrets via compose `${VAR}` interpolation from a gitignored root `.env` (never in the committed yaml/image). **Deploy mechanics:** repo on GitHub (private), droplet pulls via a read-only **deploy key**; **Mac = edit source → push; droplet = operate the stack (`git pull` + `up -d`) + hand-placed `.env` secrets**; `ufw` allows 22/80/443; migrations by hand via `alembic upgrade head`. **DNS:** A records (`@` + `www`) at Squarespace → droplet IP. **TLS:** Let's Encrypt via **certbot webroot** (shared `certbot-www` + `certbot-conf` volumes with nginx) — bootstrapped HTTP-only, then added the `:443` block + HTTP→HTTPS redirect; **nginx.conf is bind-mounted (not baked)** so config edits reload without an image rebuild; **auto-renewal** via in-stack loops (certbot `renew` every 12 h; nginx reload every 6 h), dry-run verified.
   - _Hard-won lessons (cost real time, worth not re-deriving):_ macOS is case-insensitive → a committed `DockerFile` broke the case-sensitive Linux build (`git mv -f` to fix); env-var **casing clash** between `env_file` (`REDIS_URL`) and compose `environment:` (`redis_url`) → both land in the container and pydantic non-deterministically picks the wrong one (match the casing so the override actually fires); a **URL-special char in `POSTGRES_PASSWORD`** breaks `DATABASE_URL` parsing → psycopg2 falls back to a Unix socket (use `openssl rand -hex`); Postgres major version is welded to the volume (`down -v` to re-init); **`docker compose ps` shows the port _mapping_, not what the app listens on inside** — a published port with nothing listening = connection-refused while `ps` looks green; **nginx `-s reload` re-reads config but never changes a running container's published ports** (that's creation-time → `up -d --force-recreate`); compose `command:` loops need `$$` to pass a literal `$` to the shell.
4. **CI/CD** ✅ _(2026-07-06) — `git push` to `main` now ships to prod._ GitHub Actions (`.github/workflows/deploy.yml`), two jobs: **build-and-push** builds the api + frontend images on `ubuntu-latest` (amd64 — matches the droplet, so the arm/amd64 mismatch from the RunPod worker can't recur) and pushes them to **GHCR** as **public** packages (`ghcr.io/bingliscodes/legatto-api`, `…/legatto-frontend`) using the built-in `GITHUB_TOKEN` + `packages: write` (no manual registry secret); **deploy** (`needs: build-and-push`) SSHes into the droplet (`appleboy/ssh-action`, a _dedicated_ CI key `legatto_ci` whose private half lives only in GH Actions secrets, public half in the droplet's `authorized_keys`) and runs `git pull` → `docker compose … pull` → `up -d`. The **migrate service runs on that `up -d`**, so schema changes apply automatically. **Correction to the earlier note:** this does _not_ retire the deploy key — the droplet still `git pull`s the compose files + bind-mounted nginx configs (they're not in the images), so there are now **two keys**: `legatto_deploy` (droplet → GitHub, config) and `legatto_ci` (Actions → droplet, deploy).
   - _Supporting refactors (this session):_ **(a) Compose split into base + overrides** — `compose.yaml` (env-agnostic: api/worker/**migrate**/redis/postgres, `name: legatto` pinned so volume names never drift), `compose.override.yaml` (auto-applied locally: HTTP-only nginx at `:80`), `compose.prod.yaml` (explicit `-f`: TLS nginx + certbot). Local `docker compose up` builds; prod `-f compose.yaml -f compose.prod.yaml pull && up -d` pulls the GHCR images. Fixes the anti-pattern of one file trying to serve both environments (the prod TLS config couldn't run locally). **(b) Auto-migrate on deploy** — a one-shot `migrate` service (`alembic upgrade head`, `restart: no`) that api/worker `depends_on` with `condition: service_completed_successfully`, gated behind a Postgres `pg_isready` healthcheck. Chosen over an image entrypoint because api + worker **share one image** → an entrypoint would make both race the migration. Makes a fresh/wiped DB self-heal (root-cause fix for the `down -v` → `relation "tracks" does not exist` incidents).
   - _Known future fix (optional):_ nginx caches the `api` upstream IP at config-load, so recreating the api container without restarting nginx → stale IP → 502. Prod's 6 h reload loop self-heals it; locally it needs `restart nginx`. Permanent fix = `resolver 127.0.0.11` + a variable in `proxy_pass` (per-request re-resolution).
5. **Operational hardening ✅** _(DB backups 2026-07-07; server hardening incl. non-root migration 2026-07-08)_ — **DB backups (approach A: host cron + a repo-tracked script**, chosen over an in-compose sleep-loop so a _real_ scheduler does scheduling while the script stays version-controlled + deploys via the existing `git pull`). `scripts/backup-db.sh` (strict-mode bash): `pg_dump -Fc` **inside the postgres container** (local **trust** auth → no DB password here; wrapped in `sh -c '…'` so `$POSTGRES_USER`/`$POSTGRES_DB` expand _container-side_ while the host `>` captures the streamed dump) → `aws s3 cp` to a **separate private `legatto-backups` bucket** (a dump is the whole metadata store → its own privacy boundary + blast-radius isolation from the public stems bucket) → prune to the newest `KEEP=7` (portable `sort -r | tail -n +$((KEEP+1))`, deliberately _not_ GNU-only `head -n -N`, so it's testable on macOS too). Creds: the script sources `backend/.env` and maps `SPACES_*` → the `AWS_*` names awscli actually reads (awscli **v2** on the droplet; `--endpoint-url` retargets it from AWS to Spaces). Chose **standard** Spaces over the new **cold** tier — for _metadata-only_ dumps (KB–low-MB) the per-GiB saving is a rounding error, and cold storage trades away the one property a backup needs: fast, penalty-free retrieval under duress (plus minimum-retention fees collide with keep-7). **Verified end-to-end by a manual droplet run (2026-07-06)** — dump → upload → prune all green, dump confirmed in the bucket. **Restore drill ✅ (2026-07-06):** pull dump from Spaces → `createdb legatto_restore_test` → `pg_restore` into it (custom-format → `pg_restore`, the mirror of the dump with a `<` stdin feed) → `SELECT * FROM tracks` returned the re-uploaded track → dropped the scratch DB. Restored into a **scratch DB, never the live one** — a drill mustn't risk prod. **DR tool ✅ (`scripts/restore-db.sh`, 2026-07-06)** — swap-by-rename (Option 2): fetch a _chosen_ dump (`${1:-newest}`) → safety-dump the live DB → restore into a fresh `legatto_new` while the site keeps serving → **typed `yes` confirmation** → stop api+worker (releases connections) → `ALTER DATABASE` rename `legatto`→`legatto_old`, `legatto_new`→`legatto` (renames need a connection-free DB, issued from the `postgres` maintenance DB) → start api+worker → **`docker compose restart nginx`**. Keeps `legatto_old` as a rollback point; a `legatto_old`-exists precondition check aborts _before_ stopping the app so a re-run can't strand the site down. Chose Option 2 over drop-and-restore for verify-before-cutover + rollback (_not_ zero-downtime — the rename still needs the app stopped, but downtime shrinks to just the swap). **Rehearsed on prod (2026-07-06):** surfaced exactly the gap a rehearsal exists to catch — the swap's api restart gives the container a new IP, and nginx caches the old upstream IP → **502 until nginx is bounced** (the D11-step-4 known issue, now folded into the tool as the final `restart nginx`). **Cron ✅ (2026-07-07)** — root crontab on the droplet (host state, _not_ in git — recorded here): `PATH=/usr/local/bin:/usr/bin:/bin` then `0 3 * * * /bin/bash /home/deploy/legatto/scripts/backup-db.sh >> /var/log/legatto-backup.log 2>&1` (daily 03:00 UTC; kept as **root's** cron even after the non-root migration — cron isn't the SSH attack surface — and the script's `PROJECT_DIR` now derives from `$0`, so the path won't break on a future move). Gotchas paid for: cron's minimal `PATH` hides awscli at `/usr/local/bin` (→ set PATH; and PATH entries are _directories_, not the binaries); `/bin/bash <script>` needs only read, not the execute bit (differs from direct-exec); and **cron fires in the droplet's timezone (UTC)** — a PST-vs-PDT slip (July = PDT, UTC−7) put the first test an hour off (anchor the schedule to the droplet's own `date`, don't convert in your head). Verified by a real short-interval fire (dump landed). Failure surfacing = log file for now; a dead-man's-switch is the better answer before real users. **DB backups now DONE end-to-end** (automated daily → proven restore → rehearsed DR). **Server hardening ✅:** _quick wins (2026-07-07)_ — key-only SSH (`passwordauthentication no`, so the `auth.log` `root` brute-force is defanged — bots can't beat a key), **fail2ban**, unattended-upgrades. _Non-root migration (2026-07-08)_ — created a `deploy` sudo+docker user, **relocated the app + `.env` off `/root`** → `/home/deploy/legatto`, repointed CI (**two** keys: `legatto_ci` inbound → `deploy`'s `authorized_keys` + the `DROPLET_USER` secret; `legatto_deploy` outbound → `deploy`'s `~/.ssh` for the private-repo `git pull`), made the scripts location-independent, then **disabled root SSH** (`PermitRootLogin no`). Ran as a **gated migration** — each step verified (new-user login+sudo+docker → deploy-as-`deploy` drives the stack → CI job green → backup fires) before the point of no return, DO console (hypervisor, bypasses sshd) as the escape hatch. **Hard-won lessons:** (1) NOPASSWD-vs-password sudo is ~moot here because **docker-group membership is already root-equivalent** (`docker run -v /:/host`) — the real fix would be rootless Docker; (2) `git pull` needs **`github.com` in the new user's `known_hosts`** or the non-interactive pull fails host-key verification; (3) DO ships `50-cloud-init.conf` with `PermitRootLogin yes`, and sshd takes the **first** value across `*.conf` files — so the hardening drop-in must sort first (`00-hardening.conf`) and be confirmed with `sshd -T | grep permitrootlogin`.
   - _Hard-won lesson:_ **never `scp` onto `~/.ssh/authorized_keys` — `scp <src> <dest>` truncates/overwrites `dest`, it does not append.** Copying `legatto_ci.pub` over `authorized_keys` wiped the `legatto_droplet` key and locked the Mac out (`Permission denied (publickey)`). Recovery hatch = the **DO web console** (hypervisor path, independent of sshd); the surviving key in the logs was the **DO droplet agent** re-injecting its own _ephemeral_ ECDSA key for console sessions (it's removed again afterward — normal). To _add_ a key: `ssh-copy-id` (appends + fixes perms) or `cat key.pub | ssh host 'cat >> ~/.ssh/authorized_keys'` (`>>`, never `>`). Also: a script's `export`s die with its subprocess and don't leak back to your interactive shell — why the backup uploaded fine but a follow-up `aws` call in the parent shell said "unable to locate credentials" until the `SPACES_*`→`AWS_*` mapping was re-done.

**Pre-launch gate (before onboarding real users), logged 2026-07-03 — CLEARED 2026-07-07: presigned URLs ✅ + compression ✅ (mp3) both live in prod:** the stem-serving path originally **proxied** bytes through the API (`get_stem` reads from storage → streams to the browser). Fine for the deploy + a handful of testers, but two independent upgrades gate a real-user launch:

- **Presigned URLs ✅ (shipped 2026-07-07)** — the browser now fetches each stem via a short-lived (`ExpiresIn=3600`) presigned link **direct from Spaces**, so stem egress **bypasses the droplet entirely** (removes its per-stream network/CPU ceiling — the thing that pinches before the bandwidth _bill_ does). Built as a `Storage.url_for(key) -> str | None` seam: `S3Storage` presigns via `generate_presigned_url` (a purely **local** signing op — no S3 round-trip, so it can't and needn't check existence), `LocalStorage` returns `None` and the router falls back to the retained `get_stem` proxy route — the deliberate local/S3 asymmetry, with route-knowledge kept in the router (SRP), chosen over `LocalStorage` returning a route string. Needed a **Spaces bucket CORS** rule (`GET` from `https://legatto.live`) since the fetch is now cross-origin (Web Audio `decodeAudioData` fetches the bytes), plus a frontend fix to stop prepending `/api` to absolute URLs (`url.startsWith("http") ? url : \`${API_BASE}${url}\``). **Ordering lesson:** set CORS _before_ deploy, or prod stems break the moment the presigned URLs go live.
- **Compressed stems ✅ (mp3 @ 160 kbps — implemented + locally verified 2026-07-07; prod pending a RunPod worker-image redeploy)** — was uncompressed **WAV** (~250 MB per 4-min 6-stem load → ~30–60 s load). **Lossy-vs-lossless resolved → lossy mp3:** demucs `save_audio` emits mp3 natively via **`lameenc`** (added to `runpod_worker/requirements.txt` + `requirements-local.txt`), ~10× smaller, universal `decodeAudioData` support (no Safari/Opus caveat), and transparent in an A/B at 0.5× speed. Chosen over AAC/Opus (need an ffmpeg transcode; Opus risks Safari) and FLAC (only ~2×, doesn't fix load time). One-line change in **both** separation paths (`separator.py` local + `runpod_worker/handler.py`), plus `LocalStorage.list_stems` switched to an `AUDIO_EXTENSIONS` allow-list (`.wav`+`.mp3`) so old WAV tracks and new mp3 tracks coexist and stray files (`.DS_Store`) can't sneak in. No player change (`decodeAudioData` decodes mp3 directly). **Shipped to prod** by rebuilding the RunPod **worker image** (`buildx --platform linux/amd64` — the arm/amd64 gotcha again — → GHCR `v2` → repoint the endpoint; this image is _not_ in the `git push` CI/CD). **Deploy aftermath (worth keeping):** the fresh-image **cold start** triggered a `520` on RunPod's synchronous `/runsync` — the held-open connection dies during a cold start, but the job still ran _async_ (mp3 stems landed) while the client raised → track orphaned as `failed`. Hardened `stem_separator`: **Celery retry-with-backoff** (`autoretry_for=(HTTPError,)`, `retry_backoff`, `max_retries=3`) + moved the `failed`-marking into an **`on_failure`** hook so a to-be-retried attempt can't prematurely flip the track to `failed` (which would strand the D9 self-terminating poll loop). Ships via `git push` (worker runs in the api image). Proper fix logged for later: async `endpoint.run()` + poll instead of held-open `run_sync`.

**Why deferred, not now:** vertical-slice discipline — don't stack a new cross-origin CORS + presigned flow on top of a first deploy (Phase 3 already carries containerize + nginx + DNS + TLS as simultaneous failure modes; get the proxy path working in prod first, then optimize). **No lock-in:** the change is the same size later, and at handful-of-testers scale the proxy costs ≈$0 (a droplet's ~1 TB included transfer ≈ 4,000 song-loads/mo; overage ~$0.0025/load). The real driver isn't the dollar bill — it's droplet capacity + load time, which is why _compression_ is the higher-leverage half.

**Resolved sub-decisions:**

- **GPU provider → RunPod serverless** (2026-07-02).
- **Postgres → self-hosted container** with a named volume + a scheduled `pg_dump` to Spaces (2026-07-03). Chosen over DO Managed for the ops learning (volumes, backups, restore drills); blast radius is survivable — stems live in Spaces, so worst case is losing track _metadata_, which users can re-create. The `pg_dump`-to-Spaces cron is the mitigation that makes this acceptable against the data-loss bar.
- **Domain → `legatto.live`** (2026-07-03, registered 3 yrs).
- **Routing → single domain, path-based** (2026-07-03): nginx serves the built SPA at `/` with a `try_files $uri $uri/ /index.html` **SPA fallback** (so future React Router deep-links/refreshes don't 404), and reverse-proxies the API under **`/api/*`**. The `/api` namespace keeps the entire non-API path space free for client-side routes (no React-route-vs-API-route collision) and retires the hardcoded `API_BASE`. Frontend API calls move under `/api` at the nginx step.

**Still open:** monthly cost ceiling.

### D12 — Multi-user via anonymous persistent identity (accounts + dedup deferred)

**Date:** 2026-07-08

Partially resolves D3 ("no accounts, but stay additive-ready"). The library was showing **every** user's tracks to **everybody**; the fix is per-user libraries. Chosen approach: **anonymous persistent identity** — a server-minted `users` row whose id rides in a **signed cookie**, no login — with `owner_id` on each track and per-user gating. Explicitly **not** full accounts, and **not** dedup yet.

**Why anonymous-first (the alternatives, and why they lost):**

- It solves the _actual_ problem — per-user isolation — with near-zero code and **zero login friction**, which is right for a daily-use tool.
- It's a **two-way door**: a `users` row is just an identity with no credentials, so adding OAuth later _claims_ that same row (attach a Google id — the nullable, unique `google_identity` column is the pre-wired hook), no lock-in, no data migration. That reversibility is what _licenses_ deferring real accounts.
- **Rejected full password auth** (JWT + bcrypt + reset flows): the most code and the most security surface for the least benefit now — and hand-rolling password storage is the #1 solo-project security liability. **Rejected ephemeral session-only**: doesn't persist and isn't upgradeable.

**Why dedup stays deferred (D10 Track/Asset split):** the future migration — hash existing files → build an `Asset` table → point tracks at assets by FK — is a **two-way door** (a contained, additive backfill), so deferring is _correct_, not a trap. The trigger to build it is observable: multiple users uploading the **same** files (overlap on popular tracks), ~zero at launch. When it's time, **file-hash** beats audio-fingerprinting (far lower cost/complexity; fuzzy matching isn't worth it yet).

**Data model:** `users` (UUID PK, `created_at`, nullable+unique `google_identity`) + a real FK `tracks.user_id → users.id`. Cardinality is **many tracks → one user**, so the FK sits on the _many_ side (tracks) — **no bridge table** (bridges are for many-to-many; User→Track is one-to-many, and the later Track→Asset is many-to-one — both plain FKs). Existing owner-less tracks keep `NULL` and become **invisible** (the filter never matches them) — accepted (a handful of test uploads); schema-only migration, no data purge (which also couldn't reach the stems in Spaces).

**Security bar:** the identity cookie is **signed** (Starlette `SessionMiddleware`, which uses `itsdangerous`) — tamper with it and the whole session is discarded, so a `user_id` in a valid session is _always_ server-issued: **forgery is impossible**, and the dependency therefore _trusts_ the id with no per-request DB re-check. `SESSION_SECRET` is durable, secret infra (rotating it silently logs every anonymous user out) and is **required config with no default**, so a missing secret fails loud instead of running a silent auth bypass. `session_https_only` is on in prod (off locally for HTTP).

**Access control:** a `get_current_user_id` dependency (returns the _id_ only — lazy; widen to a full `User` later if needed) reads/verifies the cookie and mints+sets it on first visit. `GET /tracks` filters by owner; `GET /{id}` returns **404** (not 403 — don't leak existence) if the track isn't yours. `get_stem` is left **capability-based / ungated on purpose**: prod serves stems via presigned Spaces URLs (get_stem is only the local-dev fallback) and `track_id`s are unguessable UUIDs — consistent with the presigned capability model.

**Implementation steps** (all verified locally — a fresh session mints an empty library, uploads persist across refresh, an incognito window is a separate user, a cross-user `GET /{id}` 404s):

1. **Schema** — `User` model + `users` table; wire `tracks.user_id` as a real **foreign key** (not a SQLAlchemy `relationship()` — the FK gives integrity; a `relationship()` is optional ORM navigation, skipped as YAGNI). Alembic migration.
2. **Anonymous identity** — a FastAPI dependency: read + verify the signed cookie → return the id; if missing/tampered → create a `users` row, sign its id into the cookie, return it.
3. **Wire the endpoints** — POST sets `user_id`; GET list filters by user; GET detail authorizes (404 otherwise).

**Hard-won lessons:**

- **FK-by-string resolves against `Base.metadata`** — `ForeignKey("users.id")` needs the `User` model _imported_ before the mappers configure, or `NoReferencedTableError` (an in-memory mapper-config error — the DB isn't even involved). Fixed once by importing every model in `app/models/__init__.py` (the runtime twin of the Alembic `env.py` import).
- **Autogenerate emits `None` constraint names** → a broken downgrade (`drop_constraint(None, …)`). Added a MetaData **`naming_convention`** on `Base` so constraints get deterministic names (`fk_tracks_user_id_users`, …).

### D13 – Progressive-tempo "speed trainer" (fingerprinting + chord detection evaluated and rejected)

**Date:** 2026-07-09

**Fuzzy matching is a liability for stem separation** An issue occurred to me with the landmark fingerprinting approach: it would require a song library to reference as the source of truth. If I were to implement it only on audio files that users upload then the first upload basically becomes the "source of truth" that all other audio will fuzzy match against, which may not be the best for the stem separation since the audios can be different qualities. Thus, the fuzzy matching would actually be a liability if the goal is simply deduplication, which leads me back to my original answer of file hashing.

(Two footnotes that don't change the call: for *dedup* the reference index would just be **our own catalog**, not a licensed corpus — so the "where do I get the songs" worry dissolves; the deeper reason it's wrong is that dedup wants *exact* matching, so fuzzy is the wrong tool regardless. Fingerprinting stays viable as a **standalone learning project** if the algorithm itself is the draw — just not in this product, and the considered *no* is itself a strong talking point.)

**Also evaluated + rejected — chord/key detection.** Works on clean triadic pop/rock (chromagram → chord classification; key from the global pitch-class profile), but degrades badly on **distorted, extended-harmony, chord-melody, arpeggiated prog/metal — exactly the audience's music** (Polyphia et al.): distortion pollutes the chroma, extended/altered voicings exceed the usual maj/min/7th vocabulary, and arpeggios are genuinely ambiguous (chord vs. melody, window-size-dependent). Would demo well and fail on real use. (Edges worth noting: running detection on the *harmonic stems* (drums/vocals removed) cleans the chromagram, and *key* is more robust than per-chord — but neither fixes the core.)

**Chosen — progressive-tempo "speed trainer."** Loop an A–B section, play N reps at a start tempo, then step up by a fixed interval and continue. Fits the **daily-habit north star**, builds directly on existing **A–B looping (D8)** + **pitch-preserving time-stretch**, and works on the music the audience actually plays. Honest tradeoff vs. chord detection: less algorithmically flashy, but it *ships* and *works* — a polished feature beats an impressive one that embarrasses you on your own songs.

**Load-bearing engineering (to plan next):** SoundTouchJS is **offline pre-stretch** (D8) — a tempo change requires re-rendering the audio, not a real-time knob. A trainer ramping through tempos (50→55→60…) must **pre-render each step** (compute the ladder upfront, or render-ahead while the current tempo plays), **stitch seamless loop transitions across tempo changes**, and keep all stems in sync. That pipeline management is the interesting, tractable challenge.

**Shipped 2026-07-14 — how it was actually built.** Config lives in a **colocated hook** (`frontend/src/hooks/use-speed-trainer.ts`): start/end/step as whole-number percents + reps, `validate()` (bounds + `end > start` + `step > 0`), and `buildLadder()` — which steps in *integer* percents and divides by 100 only at push time, so float-accumulation never enters the ladder. The `SpeedTrainer` component owns that config and receives an `onStart(ladder, reps)` callback **down** plus `loopActive`/`isTraining`/`onStop` — state is *not* lifted (colocation: keep state where it's used; hand the *action* down, not the config up). The engine is `useAudioPlayer.startTrainer`, which reads the A–B region from `loopRef`.

Four ideas carry it:

- **Render-ahead one level.** While level _i_ plays, pre-stretch level _i+1_ into a fresh Map. Buys the seamlessness of pre-computing the whole ladder without the waste of rendering steps the user never reaches — the "third door" past eager-vs-lazy.
- **Audio-clock scheduling.** SoundTouch is offline pre-stretch, so the transitions are the hard part. The next level's `source.start` is scheduled at the exact `boundary = startedAt + reps·(B−A)/tempo` on `ctx.currentTime`; `setTimeout` only wakes ~0.1 s early to *build* the sources. The JS timer decides *when to prepare*; the audio clock decides *when sound happens*.
- **Mechanism/policy split.** Extracted `startSources(buffers, offset, loop, when)` — pure mechanism (build + start + record "what's sounding") — shared by `play` (clamp/shouldLoop policy) and `startTrainer` (start-at-A, walk-the-ladder policy). One mechanism, each caller keeps its own policy: DRY *and* SRP, not a trade between them.
- **Derived tempo.** `startSources` reads the playback tempo off the buffer itself (`durationRef / buffer.duration`) so a buffer and its tempo can't drift apart — but the value is *approximate*, so it's used only for buffer-math; anything the user sees (the tempo slider on completion) uses the exact ladder value.

Lifecycle: a `trainerTimeoutRef` holds the one pending transition; cancellation is routed through `stop()` so **every** stop path (including `load()`) kills the trainer; `isTraining` state disables the transport during a run; natural completion hands back at the target tempo (keeps looping, flips `isTraining` off, syncs the slider); manual Stop = silence.

**Hard-won lessons (worth more than the feature).**

- **Two clocks.** The transition "blip" was `setTimeout` timing the audio while the audio ran on `ctx.currentTime` — and the synchronous render-ahead stretch was itself *blocking* that timer. Never schedule audio off the JS clock; anchor to `AudioContext.currentTime`, use `setTimeout` only as a coarse wake-up.
- **Derived vs. exact.** Feeding the loop the derived tempo (0.5036) but the timer the exact ladder value (0.5) made them drift apart every rep. One source of truth for a conversion; exact value for identity/display, approximate only for the math.
- **Don't derive a discrete event from a sampled signal.** Counting loop laps off the requestAnimationFrame playhead is fragile (dropped frames, and RAF *pauses* when the tab is backgrounded). Computing the level's duration from the clock made the counting problem vanish.
- **Aliasing a mutable ref.** Passing the caller's Map into a long-lived ref and then mutating it corrupted "what's playing." Fixed by copying at the boundary + a fresh map per level.
- **Imperative timers need a cancel path.** Double-Start, Stop, and even dev-time HMR left orphaned `setTimeout`s firing playback minutes later. Every path that ends playback must clear the pending timer — centralized in `stop()`.

## Build approach

**Vertical slices, tracer-bullet first.** Build one thin end-to-end path before adding breadth.

**Who writes what:** Claude scaffolds boilerplate (repo layout, dev infra, app bootstrap) and reviews. Ben writes the load-bearing logic (the upload/job/enqueue flow, the worker task, the storage & separator interfaces, the player audio logic).

### MVP build slices (shipped)

The MVP (D1) was built as three thin end-to-end slices:

1. **Tracer bullet** ✅ — upload → job row → RQ enqueue → worker runs a _stub_ separator → placeholder stems → status endpoint reports done. Proved the plumbing end-to-end **before** the heavy model (which is why installing `torch`/`demucs` could be deferred to slice 2).
2. **Real separation** ✅ — swapped the stub for `htdemucs_6s` on MPS, behind the same `Separator` interface.
3. **The player** ✅ — React + Web Audio multitrack player, per-stem mute/solo, synced playback. **MVP payoff reached.**

### Practice-feature roadmap (post-MVP)

Daily-habit features layered on the spine. (This is the "Slice N" numbering that D1 and D8 refer to — distinct from the MVP build slices above.)

4. **Slow-down + A–B looping** ✅ (D8) — pitch-preserving time-stretch (SoundTouchJS, offline pre-stretch) + native `loopStart`/`loopEnd`, on a musical-seconds transport (pause/resume/seek/tempo-change-in-place).
5. **Revisitable track library** ✅ (D9) — DB-backed persistence so tracks survive refresh and don't re-separate. Upload optimistically prepends to the list; the list polls `GET /tracks` (self-terminating when nothing's `queued`/`processing`) so status flips live; `GET /tracks/{id}` returns a stems map and clicking a `completed` track loads it into the player. `useSeparationJob` and the `/jobs` endpoint fully retired — the DB is the sole source of truth for track state. Runtime end-to-end, static analysis, and prod build are green.
6. **Production deploy** ✅ (D11) — **LIVE at `https://legatto.live`.** Serverless GPU (RunPod) + object storage (DO Spaces) + Celery/Redis + self-hosted Postgres + self-served nginx SPA on a DigitalOcean droplet (Docker Compose), HTTPS via Let's Encrypt (auto-renewing), **CI/CD via GitHub Actions — `git push` to `main` builds → GHCR → deploys.** All four build steps ✅ (detail + hard-won lessons in D11). Remaining before real users are _operational_, not deploy: Postgres backups ✅ (automated daily cron + restore drill + DR tool — see D11 step 5), server hardening, and the pre-launch gate (presigned URLs + compressed stems).
7. **Dedup via content hash** 📋 planned (D10) — split `Track` (user reference) / `Asset` (content-addressed artifact); skip re-separation on exact-file re-upload. With serverless GPU each separation is a metered per-call cost, so dedup saves real pennies + latency. Acoustic fingerprinting deferred.

**Sequencing decided (2026-07-01):** library ✅ → **full production deploy** (D11) → dedup → ongoing. The earlier "deploy CPU first, measure per-song cost, then decide GPU" plan was **overridden**: minutes-long CPU turnaround is an unacceptable product UX, so the serverless-GPU decision is made, not measured (D11).

---

## Pending (to decide next)

- ~~Confirm SQLAlchemy + Alembic vs raw SQL for DB access.~~ **Resolved (2026-06-30):** SQLAlchemy + Alembic — see D9.
- ~~Slice 2: confirm `htdemucs_6s` install path on Apple Silicon (torch + MPS).~~ **Resolved:** runs on MPS (~15s for a 64s track). Needs the `torchcodec` Python package **and** system `ffmpeg` — `torchaudio` 2.11 decodes audio via `torchcodec`, which links FFmpeg. (`ffmpeg` 8 worked despite torchcodec historically targeting 4–7.)
- Hosting/deployment target — decided; see D11 ~~(serverless GPU, Celery, DO droplet, self-served frontend). Remaining open sub-decisions: GPU provider (Modal / Replicate / RunPod), Postgres (self-hosted container vs. DO Managed), monthly cost ceiling.~~
