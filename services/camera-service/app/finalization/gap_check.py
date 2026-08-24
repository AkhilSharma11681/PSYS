from datetime import datetime
from app.db.client import get_client
from app.recognition.config import get_recognition_config
from app.finalization.camera_windows import get_camera_degraded_windows


def _in_exception_window(ts: str, exception_windows: list[tuple], actual_end: str) -> bool:
    for exit_at, return_at in exception_windows:
        window_end = return_at or actual_end
        if exit_at <= ts <= window_end:
            return True
    return False


def _excused_overlap_minutes(gap_start: str, gap_end: str, exception_windows: list[tuple], actual_end: str) -> float:
    gap_start_dt = datetime.fromisoformat(gap_start)
    gap_end_dt = datetime.fromisoformat(gap_end)
    total_minutes = 0.0
    for exit_at, return_at in exception_windows:
        window_end = return_at or actual_end
        exit_dt = datetime.fromisoformat(exit_at)
        window_end_dt = datetime.fromisoformat(window_end)
        overlap_start = max(gap_start_dt, exit_dt)
        overlap_end = min(gap_end_dt, window_end_dt)
        if overlap_start < overlap_end:
            total_minutes += (overlap_end - overlap_start).total_seconds() / 60
    return total_minutes


def _overlaps_window(range_start: str, range_end: str, windows: list[tuple]) -> bool:
    """A single isolated capture failure produces a zero-width window
    (window_start == window_end in camera_windows.py). Strict '<' would
    never register that as overlapping anything -- use '<=' so an
    isolated failure still counts as camera degradation during the gap
    it falls inside."""
    range_start_dt = datetime.fromisoformat(range_start)
    range_end_dt = datetime.fromisoformat(range_end)
    for window_start, window_end in windows:
        w_start = datetime.fromisoformat(window_start)
        w_end = datetime.fromisoformat(window_end)
        if max(range_start_dt, w_start) <= min(range_end_dt, w_end):
            return True
    return False


def compute_student_presence(session_id: str, student_id: str, actual_start: str, actual_end: str,
                              exception_windows: list[tuple] | None = None) -> dict:
    """Spec Section 5, Phase E, steps 5-9."""
    exception_windows = exception_windows or []
    client = get_client()

    session = client.table("class_sessions").select("institution_id").eq("id", session_id).execute()
    if not session.data:
        raise ValueError("session not found")
    institution_id = session.data[0]["institution_id"]
    config = get_recognition_config(institution_id)

    degraded_windows = get_camera_degraded_windows(session_id)

    obs = (client.table("attendance_observations")
           .select("captured_at, match_status, quality_score")
           .eq("session_id", session_id).eq("student_id", student_id)
           .gte("captured_at", actual_start).lte("captured_at", actual_end)
           .order("captured_at").execute())

    valid_obs = [o for o in obs.data if not _in_exception_window(o["captured_at"], exception_windows, actual_end)]

    if len(valid_obs) < config["min_valid_observations"]:
        if _overlaps_window(actual_start, actual_end, degraded_windows):
            return {"status": "camera_issue", "presence_score": None, "reason": "camera_issue_low_coverage"}
        return {"status": "uncertain", "presence_score": None, "reason": "insufficient_observations"}

    matched_count = sum(1 for o in valid_obs if o["match_status"] == "matched")
    presence_score = matched_count / len(valid_obs)

    matched_times = [o["captured_at"] for o in valid_obs if o["match_status"] == "matched"]
    boundaries = matched_times + [actual_end]

    severity = {"camera_issue": 3, "uncertain": 2, "left_early": 1}
    gap_verdict = None
    best_severity = 0

    for i in range(len(boundaries) - 1):
        gap_start, gap_end = boundaries[i], boundaries[i + 1]
        gap_minutes = (datetime.fromisoformat(gap_end) - datetime.fromisoformat(gap_start)).total_seconds() / 60
        excused_minutes = _excused_overlap_minutes(gap_start, gap_end, exception_windows, actual_end)
        effective_gap_minutes = gap_minutes - excused_minutes
        if effective_gap_minutes <= config["max_gap_minutes"]:
            continue

        if _overlaps_window(gap_start, gap_end, degraded_windows):
            this_verdict = "camera_issue"
        else:
            gap_obs = [o for o in valid_obs if gap_start <= o["captured_at"] <= gap_end]
            ambiguous = [o for o in gap_obs if o["match_status"] in ("no_face", "poor_quality")]
            clean_evidence = all((o["quality_score"] or 0) >= config["quality_threshold"] for o in ambiguous) if ambiguous else True
            this_verdict = "left_early" if clean_evidence else "uncertain"

        if severity[this_verdict] > best_severity:
            gap_verdict = this_verdict
            best_severity = severity[this_verdict]

        if gap_verdict == "camera_issue":
            break

    if gap_verdict == "camera_issue":
        status = "camera_issue"
    elif gap_verdict == "uncertain":
        status = "uncertain"
    elif gap_verdict == "left_early":
        status = "left_early"
    elif presence_score >= config["present_threshold"]:
        status = "present"
    elif presence_score <= config["left_early_threshold"]:
        status = "absent"
    else:
        status = "uncertain"

    return {"status": status, "presence_score": presence_score, "reason": gap_verdict or "presence_score"}
