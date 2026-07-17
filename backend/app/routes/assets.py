import uuid
import mimetypes
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Asset
from app.schemas import (
    UploadUrlResponse,
    AssetResponse,
    AssetListResponse,
    ThumbUrlResponse,
    DownloadUrlResponse,
)
from app.services import s3_service

router = APIRouter(prefix="/assets", tags=["assets"])

# Allowed texture formats for Phase 1
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".tga"}
ALLOWED_MIME_TYPES = {"image/png", "image/jpeg", "image/tga", "image/x-tga"}


@router.post("/upload-url", response_model=UploadUrlResponse, status_code=201)
def request_upload_url(
    filename: str,
    file_size: int = 0,
    db: Session = Depends(get_db),
):
    """
    Step 1 of the upload flow.
    Client sends the filename → we return a pre-signed S3 PUT URL.
    Client then uploads the file directly to S3 (no EC2 bandwidth used).
    """
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    mime_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    asset_id = uuid.uuid4()

    # Generate pre-signed PUT URL
    upload_url, raw_key = s3_service.generate_upload_url(asset_id, filename, mime_type)

    # Record the asset in RDS immediately with status=processing
    asset = Asset(
        id=asset_id,
        filename=filename,
        original_extension=ext.lstrip("."),
        raw_key=raw_key,
        file_size=file_size if file_size > 0 else None,
        mime_type=mime_type,
        status="processing",
    )
    db.add(asset)
    db.commit()

    return UploadUrlResponse(
        asset_id=asset_id,
        upload_url=upload_url,
        raw_key=raw_key,
    )


@router.get("", response_model=AssetListResponse)
def list_assets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str = Query(None),
    db: Session = Depends(get_db),
):
    """List all assets, paginated. Filter by status=ready|processing|error."""
    query = db.query(Asset)
    if status:
        query = query.filter(Asset.status == status)

    total = query.count()
    items = (
        query.order_by(Asset.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return AssetListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=items,
    )


@router.get("/{asset_id}", response_model=AssetResponse)
def get_asset(asset_id: uuid.UUID, db: Session = Depends(get_db)):
    """Get a single asset by ID. React polls this to check processing status."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.get("/{asset_id}/thumb-url", response_model=ThumbUrlResponse)
def get_thumb_url(asset_id: uuid.UUID, db: Session = Depends(get_db)):
    """Return a fresh pre-signed URL for the WebP thumbnail."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset.status != "ready" or not asset.thumb_key:
        raise HTTPException(status_code=409, detail="Thumbnail not ready yet")

    expires_in = 3600
    thumb_url = s3_service.generate_thumb_url(asset.thumb_key, expires_in)
    return ThumbUrlResponse(asset_id=asset_id, thumb_url=thumb_url, expires_in=expires_in)


@router.get("/{asset_id}/download-url", response_model=DownloadUrlResponse)
def get_download_url(asset_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Return a fresh pre-signed URL for the original raw texture.
    We inject ResponseContentDisposition to force browser downloads.
    """
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset.status != "ready":
        raise HTTPException(status_code=409, detail="Asset is not fully processed yet")

    expires_in = 3600  # 1 hour
    # Generate download URL using get_object with response-content-disposition parameter
    s3 = s3_service.get_s3_client()
    download_url = s3.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": s3_service.settings.s3_bucket_name,
            "Key": asset.raw_key,
            "ResponseContentDisposition": f'attachment; filename="{asset.filename}"'
        },
        ExpiresIn=expires_in,
    )
    return DownloadUrlResponse(asset_id=asset_id, download_url=download_url, expires_in=expires_in)


@router.delete("/{asset_id}", status_code=204)
def delete_asset(asset_id: uuid.UUID, db: Session = Depends(get_db)):
    """Delete an asset from RDS and both S3 objects (raw + thumb)."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    s3_service.delete_s3_objects([asset.raw_key, asset.thumb_key])
    db.delete(asset)
    db.commit()
