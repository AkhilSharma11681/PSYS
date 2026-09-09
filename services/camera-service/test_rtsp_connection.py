import sys
import cv2
import time
from app.recognition.provider import DlibFaceRecognitionProvider

def test_stream(rtsp_url: str):
    print(f"Connecting to {rtsp_url}...")
    cap = cv2.VideoCapture(rtsp_url)
    cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    if not cap.isOpened():
        print(f"❌ Failed to open stream: {rtsp_url}")
        print("Tip: Check if the IP camera app is running and your Mac is on the same network.")
        return False

    print("✅ Connection established! Grabbing test frames...")
    start_time = time.time()
    last_frame = None
    frames_read = 0
    while time.time() - start_time < 2.0:
        ok, frame = cap.read()
        if ok and frame is not None:
            last_frame = frame
            frames_read += 1

    cap.release()

    if last_frame is None:
        print("❌ Stream opened but returned no frames.")
        return False

    print(f"✅ Received {frames_read} frames. Resolution: {last_frame.shape[1]}x{last_frame.shape[0]}")

    # Test face detection
    rgb = cv2.cvtColor(last_frame, cv2.COLOR_BGR2RGB)
    provider = DlibFaceRecognitionProvider()
    faces = provider.detect(rgb)
    print(f"🔍 Face Detection: Found {len(faces)} face(s)")
    for i, face in enumerate(faces):
        q = provider.quality(rgb, face)
        print(f"   Face #{i+1}: Box=({face.top}, {face.right}, {face.bottom}, {face.left}), Quality={q:.3f}")

    # Save debug image
    cv2.imwrite("debug_live_capture.jpg", last_frame)
    print("📸 Saved preview frame to debug_live_capture.jpg")
    return True

if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "rtsp://172.20.10.1:554/stream"
    test_stream(url)
