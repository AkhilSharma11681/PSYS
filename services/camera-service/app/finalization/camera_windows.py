from app.db.client import get_client


def get_camera_degraded_windows(session_id: str) -> list[tuple]:
    """Derives time windows where capture was failing during this session,
    from capture_events -- the only historical record (camera_health only
    tracks current state, not history). Consecutive failed attempts merge
    into a single window."""
    client = get_client()
    events = (client.table("capture_events")
              .select("attempted_at, succeeded")
              .eq("session_id", session_id)
              .order("attempted_at")
              .execute())

    windows = []
    window_start = None
    window_end = None
    for e in events.data:
        if not e["succeeded"]:
            if window_start is None:
                window_start = e["attempted_at"]
            window_end = e["attempted_at"]
        else:
            if window_start is not None:
                windows.append((window_start, window_end))
                window_start = None
    if window_start is not None:
        windows.append((window_start, window_end))
    return windows
