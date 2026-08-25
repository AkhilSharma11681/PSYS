import os
import jwt
from fastapi import Header, HTTPException
from app.db.client import get_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
_jwk_client = jwt.PyJWKClient(JWKS_URL)


def get_current_user(authorization: str = Header(None)) -> dict:
    """Verifies a Supabase Auth JWT (Authorization: Bearer <token>)
    and resolves it to {user_id, institution_id, role} via public.users."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing_bearer_token")
    token = authorization.removeprefix("Bearer ")

    try:
        signing_key = _jwk_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(token, signing_key.key, algorithms=["ES256"], audience="authenticated")
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"invalid_token: {e}")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="token_missing_sub")

    client = get_client()
    user_row = client.table("users").select("institution_id, role").eq("id", user_id).execute()
    if not user_row.data:
        raise HTTPException(status_code=401, detail="user_not_found")

    return {
        "user_id": user_id,
        "institution_id": user_row.data[0]["institution_id"],
        "role": user_row.data[0]["role"],
    }


def require_same_institution(current_user: dict, resource_institution_id: str):
    if current_user["institution_id"] != resource_institution_id:
        raise HTTPException(status_code=403, detail="cross_tenant_access_denied")
