import os
from datetime import datetime, timezone
from PIL import Image
import numpy as np
from app.recognition.pipeline import process_frame

INSTITUTION_ID = "70881552-0663-494b-8b95-59cfdd5fb246"
SESSION_ID = "3ac542c7-bbc5-45d4-865a-a7b5aa67e237"

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../test-images"))

images_to_test = [
    os.path.join(BASE_DIR, "ansh.jpg"),
    os.path.join(BASE_DIR, "rohan.jpeg"),
    os.path.join(BASE_DIR, "aditya raj.jpeg"),
    os.path.join(BASE_DIR, "akhil.jpg")
]

for img_path in images_to_test:
    print(f"\n--- Testing {os.path.basename(img_path)} ---")
    try:
        img = Image.open(img_path).convert("RGB")
        frame = np.array(img)

        captured_at = datetime.now(timezone.utc).isoformat()
        result = process_frame(frame, INSTITUTION_ID, SESSION_ID, frame_path=img_path, captured_at=captured_at)
        print("Result:", result)
    except Exception as e:
        print("Error:", e)
