from datetime import datetime, timezone, timedelta
from app.db.client import get_client
from app.finalization.gap_check import compute_student_presence

client = get_client()

INSTITUTION_ID = "485a5846-54c5-48bf-a523-6f86ecb54c42"
SESSION_ID = "b8a2512c-ed44-4116-8dbf-6b557e123592"
STUDENT_B = "cf18112a-e598-4db4-8bb4-0574c83e4dd9"
TEACHER_ID = "33333333-3333-3333-3333-333333333333"

client.table("attendance_observations").delete().eq("session_id", SESSION_ID).execute()
client.table("session_exceptions").delete().eq("session_id", SESSION_ID).execute()

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

# Simulate: matched early, permitted exit at ~10min, poor-quality captures
# during the excused window (would normally look ambiguous), matched again
# after return at ~20min.
insert_obs(STUDENT_B, 0, "matched")
insert_obs(STUDENT_B, 5, "matched")
insert_obs(STUDENT_B, 12, "poor_quality", quality=0.1)
insert_obs(STUDENT_B, 15, "poor_quality", quality=0.1)
insert_obs(STUDENT_B, 18, "poor_quality", quality=0.1)
insert_obs(STUDENT_B, 22, "matched")
insert_obs(STUDENT_B, 25, "matched")

# WITHOUT exception wiring -- baseline
result_no_exception = compute_student_presence(SESSION_ID, STUDENT_B, actual_start, actual_end)
print("WITHOUT exception_windows:", result_no_exception)

# Mark a permitted exit covering the ambiguous window
client.table("session_exceptions").insert({
    "institution_id": INSTITUTION_ID,
    "session_id": SESSION_ID,
    "student_id": STUDENT_B,
    "marked_by": TEACHER_ID,
    "reason": "test: sent to office",
    "exit_at": (base + timedelta(minutes=10)).isoformat(),
    "return_at": (base + timedelta(minutes=20)).isoformat(),
}).execute()

# Pull exceptions via the RPC exactly as the finalize job will
rpc_result = client.rpc("get_session_exceptions", {"p_session_id": SESSION_ID}).execute()
print("\nRPC output:", rpc_result.data)

# Transform RPC output into the (exit_at, return_at) tuple shape
# compute_student_presence expects, scoped to this one student
exception_windows = [
    (row["window_start"], row["window_end"])
    for row in rpc_result.data
    if row["student_id"] == STUDENT_B
]
print("Formatted exception_windows:", exception_windows)

result_with_exception = compute_student_presence(
    SESSION_ID, STUDENT_B, actual_start, actual_end, exception_windows=exception_windows
)
print("\nWITH exception_windows:", result_with_exception)

client.table("attendance_observations").delete().eq("session_id", SESSION_ID).execute()
client.table("session_exceptions").delete().eq("session_id", SESSION_ID).execute()
