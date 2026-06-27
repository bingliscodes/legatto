from fastapi import FastAPI

from .routers import jobs as jobs_router
from .routers import tracks as tracks_router

app = FastAPI(title="Guitarist Practice Tool API")

app.include_router(jobs_router.router)
app.include_router(tracks_router.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
