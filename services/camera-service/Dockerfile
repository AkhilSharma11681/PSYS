FROM python:3.11-slim

# dlib needs a compiler toolchain + cmake to build from source on Linux.
# git is needed separately -- python:3.11-slim doesn't include it, but
# pip install git+https://... requires it.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake libopenblas-dev liblapack-dev git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# dlib's cmake build defaults to using all available cores in parallel,
# each consuming significant memory -- this exceeded Render's free-tier
# build machine limits (8GB+ used, build killed with OOM). Forcing a
# single-threaded build trades build speed for staying within memory
# limits. CONFIRMED WORKING on Render: 553s build time, no OOM.
ENV CMAKE_BUILD_PARALLEL_LEVEL=1
ENV MAKEFLAGS="-j1"
RUN pip install --no-cache-dir -r requirements.txt

# face_recognition depends on face_recognition_models, but the PyPI
# release of that package has known install issues (large model file,
# resolution failures on newer pip/setuptools). SETUP.md documents this
# same workaround for local dev -- installing straight from GitHub
# avoids the broken PyPI path. Requires git (installed above).
RUN pip install --no-cache-dir git+https://github.com/ageitgey/face_recognition_models

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
