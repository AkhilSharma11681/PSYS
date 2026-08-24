FROM python:3.11-slim

# dlib needs a compiler toolchain + cmake to build from source on Linux.
# This is NOT the same issue as the Mac/conda situation in SETUP.md --
# that was Apple Silicon + Python 3.14 specific. Standard Linux + Python
# 3.11 compiles dlib fine with these packages present.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake libopenblas-dev liblapack-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
