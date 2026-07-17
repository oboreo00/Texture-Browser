import uuid
import boto3
from botocore.exceptions import ClientError
from app.config import get_settings

settings = get_settings()

_s3_client = None


def get_s3_client():
    """Lazy singleton — reuse the same client across requests."""
    global _s3_client
    if _s3_client is None:
        # Force regional endpoint — presigned URLs break if signed against the
        # global endpoint (s3.amazonaws.com) for buckets outside us-east-1.
        _s3_client = boto3.client(
            "s3",
            region_name=settings.aws_region,
            endpoint_url=f"https://s3.{settings.aws_region}.amazonaws.com",
        )
    return _s3_client


def generate_upload_url(asset_id: uuid.UUID, filename: str, mime_type: str) -> tuple[str, str]:
    """
    Generate an S3 pre-signed PUT URL.
    The client uploads directly to S3 — no file bytes touch EC2.

    Returns:
        (presigned_url, raw_key)
    """
    s3 = get_s3_client()
    raw_key = f"{settings.s3_raw_prefix}/{asset_id}/{filename}"

    presigned_url = s3.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.s3_bucket_name,
            "Key": raw_key,
            # ContentType intentionally omitted — if signed, any mismatch
            # (e.g. browser sending empty string) causes a 403 before the
            # request even appears in DevTools.
        },
        ExpiresIn=300,  # 5 minutes to complete the upload
    )
    return presigned_url, raw_key


def generate_thumb_url(thumb_key: str, expires_in: int = 3600) -> str:
    """
    Generate a pre-signed GET URL for a thumbnail.
    Expires in 1 hour by default — enough for a browser session.
    """
    s3 = get_s3_client()
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket_name, "Key": thumb_key},
        ExpiresIn=expires_in,
    )


def delete_s3_objects(keys: list[str]) -> None:
    """Delete one or more S3 objects by key (used when deleting an asset)."""
    s3 = get_s3_client()
    objects = [{"Key": k} for k in keys if k]
    if objects:
        s3.delete_objects(
            Bucket=settings.s3_bucket_name,
            Delete={"Objects": objects},
        )
