from fastapi import FastAPI

app = FastAPI(title="Guitarist Practice Tool API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
