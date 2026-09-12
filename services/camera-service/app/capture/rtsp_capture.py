import cv2
import time
try:
    cv2.utils.logging.setLogLevel(cv2.utils.logging.LOG_LEVEL_SILENT)
except AttributeError:
    pass

def grab_frame(rtsp_url: str, timeout_ms: int = 5000, rotation_degrees: int = 0):
    cap = cv2.VideoCapture(rtsp_url)
    cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, timeout_ms)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    try:
        if not cap.isOpened():
            return None, "could_not_open_stream"

        # RTSP Auto-Exposure & Stabilization Phase (1.0 second)
        # Mobile IP webcam apps take roughly 0.5-1.0s after connection
        # to adjust exposure, white balance, and clear their initial keyframe buffer.
        # We read continuously for 1.0s, taking the absolute freshest, fully-stabilized frame.
        start_time = time.time()
        last_good_frame = None
        while time.time() - start_time < 1.0:
            ok, frame = cap.read()
            if ok and frame is not None:
                last_good_frame = frame

        if last_good_frame is None:
            return None, "no_frame_returned"

        # Optional rotation correction (0, 90, 180, 270 degrees)
        if rotation_degrees == 90:
            last_good_frame = cv2.rotate(last_good_frame, cv2.ROTATE_90_CLOCKWISE)
        elif rotation_degrees == 180:
            last_good_frame = cv2.rotate(last_good_frame, cv2.ROTATE_180)
        elif rotation_degrees in (270, -90):
            last_good_frame = cv2.rotate(last_good_frame, cv2.ROTATE_90_COUNTERCLOCKWISE)

        frame_rgb = cv2.cvtColor(last_good_frame, cv2.COLOR_BGR2RGB)
        return frame_rgb, None
    except Exception:
        return None, "capture_exception"
    finally:
        cap.release()
