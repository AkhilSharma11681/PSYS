from datetime import datetime, timezone, timedelta
from app.db.client import get_client
from app.finalization.gap_check import compute_student_presence

client = get_client()
INSTITUTION_ID = "485a5846-54c5-48bf-a523-6f86ecb54c42"
SESSION_ID = "b8a2512c-ed44-4116-8dbf-6b557e123592"
STUDENT_A = "c8efd6a6-e899-4686-a537-6f252efaf9d2"
STUDENT_B = "b765552c-a591-4935-a0a6-b2461524ba38"

client.table("attendance_observations").delete().eq("session_id", SESSION_ID).execute()

base = datetime.now(timezone.utc)
actual_start = base.isoformat()
actual_end = (base + timedelta(minutes=30)).isoformat()


def insert_obs(student_id, minutes_offset, match_status, quality=1.0):
    client.table("attendance_observations").insert({
        "institution_id": INSTITUTION_ID, "session_id": SESSION_ID, "student_id": student_id,
        "captured_at": (base + timedelta(minutes=minutes_offset)).isoformat(),
        "similarity_score": 0.9 if match_status == "matched" else None,
        "quality_score": quality, "match_status": match_status, "model_version": "dlib_resnet_v1",
    }).execute()


# Student A: matched throughout -> expect "present"
for m in [0, 5, 10, 15, 20, 25]:
    insert_obs(STUDENT_A, m, "matched")

result_a = compute_student_presence(SESSION_ID, STUDENT_A, actual_start, actual_end)
print("Student A (matched throughout):", result_a)
assert result_a["status"] == "present", f"expected present, got {result_a}"
print("  PASS")

client.table("attendance_observations").delete().eq("session_id", SESSION_ID).eq("student_id", STUDENT_B).execute()

# Student B: matched early, then a long CLEAN no_face gap -> expect "left_early"
for m in [0, 5]:
    insert_obs(STUDENT_B, m, "matched")
for m in [10, 15, 20, 25]:
    insert_obs(STUDENT_B, m, "no_face", quality=0.9)  # clean, well-lit -- real absence evidence

result_b = compute_student_presence(SESSION_ID, STUDENT_B, actual_start, actual_end)
print("Student B (matched then clean no_face gap):", result_b)
assert result_b["status"] == "left_early", f"expected left_early, got {result_b}"
print("  PASS")

client.table("attendance_observations").delete().eq("session_id", SESSION_ID).eq("student_id", STUDENT_B).execute()

# Student B again: matched early, then a long POOR-QUALITY gap (occlusion-like) -> expect "uncertain"
for m in [0, 5]:
    insert_obs(STUDENT_B, m, "matched")
for m in [10, 15, 20, 25]:
    insert_obs(STUDENT_B, m, "poor_quality", quality=0.1)  # degraded -- can't tell if absent or occluded

result_c = compute_student_presence(SESSION_ID, STUDENT_B, actual_start, actual_end)
print("Student B (matched then degraded-quality gap):", result_c)
assert result_c["status"] == "uncertain", f"expected uncertain, got {result_c}"
print("  PASS")

client.table("attendance_observations").delete().eq("session_id", SESSION_ID).execute()

# Student A again: only 1 observation -> expect "uncertain" (insufficient coverage)
insert_obs(STUDENT_A, 0, "matched")
result_d = compute_student_presence(SESSION_ID, STUDENT_A, actual_start, actual_end)
print("Student A (only 1 observation):", result_d)
assert result_d["status"] == "uncertain" and result_d["reason"] == "insufficient_observations"
print("  PASS")

client.table("attendance_observations").delete().eq("session_id", SESSION_ID).execute()
print("\nAll gap-check tests passed")

# --- NEW: camera_issue case ---
from app.finalization.gap_check import compute_student_presence as _recompute
CAMERA_ID = "fa955acb-1b5b-4330-83c1-e10f3fa11810"

client.table("attendance_observations").delete().eq("session_id", SESSION_ID).eq("student_id", STUDENT_B).execute()
client.table("capture_events").delete().eq("session_id", SESSION_ID).execute()

for m in [0, 5]:
    insert_obs(STUDENT_B, m, "matched")

# Simulate the camera genuinely failing during the gap window (10-25 min)
for m in [10, 15, 20, 25]:
    client.table("capture_events").insert({
        "institution_id": INSTITUTION_ID, "session_id": SESSION_ID, "camera_id": CAMERA_ID,
        "attempted_at": (base + timedelta(minutes=m)).isoformat(),
        "succeeded": False, "error": "could_not_open_stream", "frame_stored": False,
    }).execute()
    # note: no attendance_observations row for these -- camera failed before
    # recognition could even run, so there's genuinely nothing to log there

result_e = _recompute(SESSION_ID, STUDENT_B, actual_start, actual_end)
print("Student B (camera failed during gap):", result_e)
assert result_e["status"] == "camera_issue", f"expected camera_issue, got {result_e}"
print("  PASS")

client.table("capture_events").delete().eq("session_id", SESSION_ID).execute()
client.table("attendance_observations").delete().eq("session_id", SESSION_ID).execute()
print("\nAll gap-check tests (including camera_issue) passed")
