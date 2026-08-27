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
    if not creds:
        return f"rtsp://{host}{stream_path}"
    return f"rtsp://{creds}@{host}{stream_path}"
