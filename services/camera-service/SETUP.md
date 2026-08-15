# camera-service setup

⚠️ Do NOT use a plain venv + pip for dlib — it fails to compile on
Apple Silicon + Python 3.14 (missing legacy `fp.h` header in dlib's
bundled libpng). Use conda instead:

```bash
conda create -n psys-camera python=3.11 -y
conda activate psys-camera
conda install -c conda-forge dlib -y
pip install -r requirements.txt
pip install git+https://github.com/ageitgey/face_recognition_models
```

Every new terminal tab, activate with:
```bash
conda activate psys-camera
```
(not `source venv/bin/activate` — there is no venv anymore)

Run the server:
```bash
uvicorn app.main:app --reload --port 8000
```
