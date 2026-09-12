import os

def resolve_credential(credential_ref: str) -> str:
    """Resolve a credential_ref (a name, stored in DB) to the real
    'user:pass' string, which only ever lives in env vars -- never in
    the database, never in an API response, never logged.

    An intentionally empty env var (set to "") means 'this camera
    needs no auth' -- distinct from a missing env var, which is a
    real configuration error."""
    env_key = credential_ref.upper()
    value = os.environ.get(env_key)
    if value is None:
        raise ValueError(f"no credential found for ref: {credential_ref}")
    return value


def build_rtsp_url(host: str, stream_path: str, credential_ref: str) -> str:
    creds = resolve_credential(credential_ref)

    # Strip any leading rtsp:// or http:// if user entered full URL as host
    clean_host = host.strip()
    if clean_host.startswith("rtsp://"):
        clean_host = clean_host[7:]
    elif clean_host.startswith("http://"):
        clean_host = clean_host[7:]

    # If host already contains a path (e.g. 10.7.13.65:554/stream), extract just host:port
    if "/" in clean_host:
        parts = clean_host.split("/", 1)
        clean_host = parts[0]
        if not stream_path or stream_path == "/":
            stream_path = "/" + parts[1]

    # Ensure stream_path begins with /
    if stream_path and not stream_path.startswith("/"):
        stream_path = "/" + stream_path

    if not creds:
        return f"rtsp://{clean_host}{stream_path}"
    return f"rtsp://{creds}@{clean_host}{stream_path}"
