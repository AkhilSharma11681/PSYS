import sys
from app.capture.rtsp_capture import grab_frame
from app.capture.health import update_camera_health

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python test_camera.py <rtsp_url> <camera_id>")
        sys.exit(1)

    rtsp_url, camera_id = sys.argv[1], sys.argv[2]
    frame, error = grab_frame(rtsp_url)

    if frame is not None:
        print(f"✅ Captured frame, shape={frame.shape}")
        update_camera_health(camera_id, succeeded=True, error=None)
    else:
        print(f"❌ Capture failed: {error}")
        update_camera_health(camera_id, succeeded=False, error=error)
