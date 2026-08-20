import time
import cv2
from app.capture.storage import upload_frame
from app.recognition.pipeline import process_frame
from app.db.client import get_client

INSTITUTION_ID = "485a5846-54c5-48bf-a523-6f86ecb54c42"
SESSION_ID = "b8a2512c-ed44-4116-8dbf-6b557e123592"
CAMERA_ID = "fa955acb-1b5b-4330-83c1-e10f3fa11810"

cap = cv2.VideoCapture(0)
if not cap.isOpened():
    raise RuntimeError("Could not open webcam")

print("Camera me dekho... 2 second me capture hoga")
time.sleep(2)
ok, frame = cap.read()
cap.release()
if not ok or frame is None:
    raise RuntimeError("Failed to grab frame from webcam")

frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

frame_path = upload_frame(frame_rgb, INSTITUTION_ID, SESSION_ID, CAMERA_ID)
print(f"frame_path: {frame_path}")

result = process_frame(frame_rgb, INSTITUTION_ID, SESSION_ID, frame_path)
print(f"process_frame result: {result}")

client = get_client()
latest = (client.table("attendance_observations")
          .select("id, match_status, evidence_photo_url, captured_at")
          .eq("session_id", SESSION_ID)
          .order("captured_at", desc=True)
          .limit(1)
          .execute())
print(f"latest observation row: {latest.data}")
