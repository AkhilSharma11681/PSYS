import time
import cv2
from app.recognition.pipeline import process_frame

INSTITUTION_ID = "485a5846-54c5-48bf-a523-6f86ecb54c42"
SESSION_ID = "b8a2512c-ed44-4116-8dbf-6b557e123592"

cap = cv2.VideoCapture(0)  # Mac's built-in webcam
if not cap.isOpened():
    raise RuntimeError(
        "Could not open webcam — check System Settings > Privacy & Security "
        "> Camera permissions for Terminal/VS Code"
    )

print("Camera me dekho... 2 second me capture hoga")
time.sleep(2)

ok, frame = cap.read()
cap.release()

if not ok or frame is None:
    raise RuntimeError("Failed to grab frame from webcam")

frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)  # same conversion as grab_frame

result = process_frame(frame_rgb, INSTITUTION_ID, SESSION_ID)
print(result)
