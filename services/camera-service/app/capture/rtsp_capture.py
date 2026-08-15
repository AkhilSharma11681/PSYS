import cv2

cv2.utils.logging.setLogLevel(cv2.utils.logging.LOG_LEVEL_SILENT)


def grab_frame(rtsp_url: str, timeout_ms: int = 5000):
    """Attempt to grab a single frame from an RTSP stream.
    Returns (frame, None) on success or (None, error_message) on failure.
    Never raises — callers rely on this to keep the scheduler alive.
    """
    cap = cv2.VideoCapture(rtsp_url)
    cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, timeout_ms)
    try:
        if not cap.isOpened():
            return None, "could_not_open_stream"
        ok, frame = cap.read()
        if not ok or frame is None:
            return None, "no_frame_returned"
        return frame, None
    except Exception:
        return None, "capture_exception"
    finally:
        cap.release()
