from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class AssetBase(BaseModel):
    filename: str


class AssetCreate(AssetBase):
    """Returned immediately after the client requests an upload URL."""
    pass


class UploadUrlResponse(BaseModel):
    """What we send back when the client wants to upload a file."""
    asset_id: uuid.UUID
    upload_url: str       # S3 pre-signed PUT URL — client uploads directly to S3
    raw_key: str          # S3 key where the file will land


class AssetResponse(BaseModel):
    """Full asset representation returned from GET endpoints."""
    id: uuid.UUID
    filename: str
    original_extension: Optional[str]
    raw_key: str
    thumb_key: Optional[str]
    file_size: Optional[int]
    mime_type: Optional[str]
    width: Optional[int]
    height: Optional[int]
    status: str           # processing | ready | error
    tags: Optional[list[str]]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AssetListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[AssetResponse]


class ThumbUrlResponse(BaseModel):
    asset_id: uuid.UUID
    thumb_url: str        # S3 pre-signed GET URL for the WebP thumbnail
    expires_in: int       # seconds until pre-signed URL expires


class DownloadUrlResponse(BaseModel):
    asset_id: uuid.UUID
    download_url: str     # S3 pre-signed GET URL for the original raw texture
    expires_in: int       # seconds until pre-signed URL expires
