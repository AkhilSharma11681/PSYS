from PIL import Image
import numpy as np
from app.recognition.pipeline import process_frame

INSTITUTION_ID = "485a5846-54c5-48bf-a523-6f86ecb54c42"
SESSION_ID = "b8a2512c-ed44-4116-8dbf-6b557e123592"

img = Image.open("test_face.jpg").convert("RGB")
frame = np.array(img)

result = process_frame(frame, INSTITUTION_ID, SESSION_ID)
print(result)
