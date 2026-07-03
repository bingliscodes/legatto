# CUDA PyTorch baked in — sidesteps the "did pip install CPU torch?" trap
FROM pytorch/pytorch:2.5.1-cuda12.1-cudnn9-runtime

# system dep: ffmpeg for audio decoding (torchcodec links it)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# worker-only Python deps (NOT your app's requirements — no fastapi/celery here)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN python -c "from demucs.pretrained import get_model; get_model('htdemucs_6s')"

COPY handler.py .

CMD ["python", "handler.py"]