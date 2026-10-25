import hmac
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import Asset

router = APIRouter(prefix="/internal", tags=["internal"])


class ProcessedUpdate(BaseModel):
    status: str
    thumb_key: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    tags: Optional[list[str]] = None


def _authorized(got: str, expected: str) -> bool:
    if not expected or not got:
        return False
    return hmac.compare_digest(got, expected)


@router.post("/assets/{asset_id}/processed")
def mark_processed(
    asset_id: uuid.UUID,
    body: ProcessedUpdate,
    db: Session = Depends(get_db),
    x_internal_token: str = Header(default=""),
):
    """Lambda calls this after it writes a thumbnail. Postgres stays on localhost."""
    if not _authorized(x_internal_token, get_settings().internal_api_token):
        raise HTTPException(status_code=401, detail="unauthorized")

    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    asset.status = body.status
    if body.thumb_key is not None:
        asset.thumb_key = body.thumb_key
    if body.width is not None:
        asset.width = body.width
    if body.height is not None:
        asset.height = body.height
    if body.tags:
        asset.tags = body.tags
    db.commit()
    return {"ok": True}
