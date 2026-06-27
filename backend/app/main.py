from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import jobs as jobs_router
from .routers import tracks as tracks_router

app = FastAPI(title="Guitarist Practice Tool API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs_router.router)
app.include_router(tracks_router.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
