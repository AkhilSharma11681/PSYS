import cv2
try:
    cv2.utils.logging.setLogLevel(cv2.utils.logging.LOG_LEVEL_SILENT)
except AttributeError:
    pass  # not available in this opencv-python-headless build; harmless to skip


def grab_frame(rtsp_url: str, timeout_ms: int = 5000):
    """Attempt to grab a single frame from an RTSP stream.
    Returns (frame, None) on success or (None, error_message) on failure.
    Never raises — callers rely on this to keep the scheduler alive.

    IMPORTANT: OpenCV always decodes frames as BGR, but face_recognition/dlib
    expect RGB — we convert here so every downstream caller (recognition
    pipeline, tests) gets a correctly-ordered frame without needing to
    remember this themselves.
    """
    cap = cv2.VideoCapture(rtsp_url)
    cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, timeout_ms)
    try:
        if not cap.isOpened():
            return None, "could_not_open_stream"
        ok, frame = cap.read()
        if not ok or frame is None:
            return None, "no_frame_returned"
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        return frame_rgb, None
    except Exception:
        return None, "capture_exception"
    finally:
        cap.release()
