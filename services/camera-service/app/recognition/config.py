from app.db.client import get_client

_cache = {}  # simple in-memory cache, keyed by institution_id


def get_recognition_config(institution_id: str):
    """Institution-specific config if it exists and is active, else the
    platform default (institution_id is null). Cached per-process — a
    server restart picks up config changes, which is fine for MVP."""
    if institution_id in _cache:
        return _cache[institution_id]

    client = get_client()

    result = (
        client.table("attendance_config")
        .select("*")
        .eq("institution_id", institution_id)
        .eq("is_active", True)
        .execute()
    )

    if not result.data:
        result = (
            client.table("attendance_config")
            .select("*")
            .is_("institution_id", "null")
            .eq("is_active", True)
            .execute()
        )

    if not result.data:
        raise RuntimeError("no attendance_config found — not even a platform default")

    config = result.data[0]
    _cache[institution_id] = config
    return config
