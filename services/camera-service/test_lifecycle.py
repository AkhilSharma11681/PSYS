import time
from datetime import datetime, timezone, timedelta
from app.db.client import get_client
from app.scheduling.lifecycle import run_tick
from app.scheduling.generate_sessions import DAY_CODES

client = get_client()
INSTITUTION_ID = "485a5846-54c5-48bf-a523-6f86ecb54c42"
CLASS_ID = "44444444-4444-4444-4444-444444444444"
ROOM_ID = "75e293be-bedb-452d-b9cc-15981c50b26c"

now = datetime.now(timezone.utc)
start = now  # due immediately -- within LEAD_MINUTES window and already past start
end = now + timedelta(minutes=1)
today_code = DAY_CODES[now.weekday()]
recurrence = f"{today_code} {start.strftime('%H:%M')}-{end.strftime('%H:%M')}"
print(f"recurrence: {recurrence}")

client.table("class_sessions").delete().eq("class_id", CLASS_ID).gte("scheduled_start", (now - timedelta(minutes=5)).isoformat()).execute()
client.table("class_enrollments").delete().eq("class_id", CLASS_ID).execute()
client.table("classes").delete().eq("id", CLASS_ID).execute()
client.table("classes").insert({
    "id": CLASS_ID, "institution_id": INSTITUTION_ID, "room_id": ROOM_ID,
    "subject": "Lifecycle Test", "recurrence": recurrence, "is_active": True,
}).execute()

existing = client.table("attendance_config").select("id").eq("institution_id", INSTITUTION_ID).execute()
if existing.data:
    client.table("attendance_config").update({"capture_buffer_minutes": 0}).eq("institution_id", INSTITUTION_ID).execute()
else:
    client.table("attendance_config").insert({"institution_id": INSTITUTION_ID, "capture_buffer_minutes": 0, "is_active": True}).execute()

result1 = run_tick()
ours = [r for r in [result1] if True]
print("Tick 1 (full):", result1)

session = client.table("class_sessions").select("id, status, processing_status, scheduled_end").eq("class_id", CLASS_ID).execute()
print("Our session after tick 1:", session.data)

print("Waiting 65s for scheduled_end to pass...")
time.sleep(65)

result2 = run_tick()
print("Tick 2 (full):", result2)

session2 = client.table("class_sessions").select("id, status, processing_status, finalized_at").eq("class_id", CLASS_ID).execute()
print("Our session after tick 2:", session2.data)
