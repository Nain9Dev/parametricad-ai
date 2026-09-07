FROM python:3.12-slim AS base

# OpenCASCADE and VTK link against the system OpenGL and X11 stack even when
# rendering headless, so these have to be present at import time.
RUN apt-get update && apt-get install --no-install-recommends -y \
        libgl1 \
        libglx-mesa0 \
        libegl1 \
        libxrender1 \
        libxext6 \
        libsm6 \
        libice6 \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dependencies are copied first so a source change does not rebuild the ~1 GB
# OpenCASCADE layer.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ./app ./app

# Generated artifacts are written at runtime; the directory has to exist and be
# writable by the unprivileged user the service runs as.
RUN useradd --create-home --uid 10001 parametricad \
    && mkdir -p /app/static/models \
    && chown -R parametricad:parametricad /app/static
USER parametricad

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health').read()"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
