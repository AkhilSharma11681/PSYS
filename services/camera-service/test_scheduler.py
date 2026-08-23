from datetime import datetime, timezone, timedelta
from app.db.client import get_client
from app.scheduling.generate_sessions import generate_due_sessions, DAY_CODES

client = get_client()
INSTITUTION_ID = "485a5846-54c5-48bf-a523-6f86ecb54c42"
CLASS_ID = "44444444-4444-4444-4444-444444444444"
ROOM_ID = "75e293be-bedb-452d-b9cc-15981c50b26c"

now = datetime.now(timezone.utc)
start = now + timedelta(minutes=10)
end = now + timedelta(minutes=70)
today_code = DAY_CODES[now.weekday()]
recurrence = f"{today_code} {start.strftime('%H:%M')}-{end.strftime('%H:%M')}"
print(f"Testing with recurrence: {recurrence}")

client.table("class_sessions").delete().eq("class_id", CLASS_ID).gte("scheduled_start", now.isoformat()).execute()
client.table("class_enrollments").delete().eq("class_id", CLASS_ID).execute()
client.table("classes").delete().eq("id", CLASS_ID).execute()
client.table("classes").insert({
    "id": CLASS_ID, "institution_id": INSTITUTION_ID, "room_id": ROOM_ID,
    "subject": "Scheduler Test", "recurrence": recurrence, "is_active": True,
}).execute()

created = generate_due_sessions()
print("First run:", created)
assert len(created) >= 1, "expected at least one session created"
assert any(c["class_id"] == CLASS_ID for c in created), "expected our test class's session"
print("  PASS")

created2 = generate_due_sessions()
duplicate = [c for c in created2 if c["class_id"] == CLASS_ID]
print("Second run (idempotency check):", created2)
assert len(duplicate) == 0, "expected no duplicate session on second run"
print("  PASS")

print("\nAll scheduler tests passed")
