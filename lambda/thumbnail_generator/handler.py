import boto3
import io
import os
import psycopg2
from PIL import Image

# ── Config from Lambda environment variables ──────────────────────────────────
BUCKET_NAME   = os.environ["S3_BUCKET_NAME"]
THUMBS_PREFIX = os.environ.get("S3_THUMBS_PREFIX", "textures/thumbs")
THUMB_SIZE    = (512, 512)   # max width × height — preserves aspect ratio
THUMB_QUALITY = 85           # WebP quality (85 = great balance of size/clarity)
DATABASE_URL  = os.environ["DATABASE_URL"]
# Format: postgresql://user:password@host:5432/dbname


def lambda_handler(event, context):
    """
    Triggered by: S3 ObjectCreated event on textures/raw/*
    
    Flow:
      1. Parse the S3 key from the event
      2. Download the raw texture from S3
      3. Generate a 512×512 WebP thumbnail with Pillow
      4. Write the thumbnail back to S3 at textures/thumbs/{uuid}/thumb.webp
      5. Update the RDS asset record: thumb_key, status='ready'
    
    Returns nothing meaningful — Lambda result is ignored.
    The client learns about completion by polling GET /assets/{id}.
    """
    s3 = boto3.client("s3")
    processed = []

    for record in event["Records"]:
        bucket  = record["s3"]["bucket"]["name"]
        raw_key = record["s3"]["object"]["key"]
        # raw_key pattern: textures/raw/{uuid}/{filename}

        # ── Extract asset UUID from S3 key path ──────────────────────────────
        parts    = raw_key.split("/")
        # parts = ["textures", "raw", "{uuid}", "{filename}"]
        if len(parts) < 4:
            print(f"[SKIP] Unexpected key format: {raw_key}")
            continue

        asset_id = parts[2]
        thumb_key = f"{THUMBS_PREFIX}/{asset_id}/thumb.webp"

        try:
            # ── 1. Download raw texture ───────────────────────────────────────
            print(f"[INFO] Downloading s3://{bucket}/{raw_key}")
            obj      = s3.get_object(Bucket=bucket, Key=raw_key)
            img_data = obj["Body"].read()

            # ── 2. Generate thumbnail ─────────────────────────────────────────
            img = Image.open(io.BytesIO(img_data)).convert("RGB")
            original_size = img.size
            img.thumbnail(THUMB_SIZE, Image.LANCZOS)  # in-place, preserves ratio

            # ── 3. Encode as WebP ─────────────────────────────────────────────
            buf = io.BytesIO()
            img.save(buf, format="WEBP", quality=THUMB_QUALITY)
            buf.seek(0)
            thumb_bytes = len(buf.getvalue())

            # ── 4. Upload thumbnail to S3 ─────────────────────────────────────
            print(f"[INFO] Writing thumbnail to s3://{bucket}/{thumb_key} ({thumb_bytes} bytes)")
            s3.put_object(
                Bucket=bucket,
                Key=thumb_key,
                Body=buf,
                ContentType="image/webp",
            )

            # ── 5. Update RDS record ──────────────────────────────────────────
            _update_asset_record(
                asset_id=asset_id,
                thumb_key=thumb_key,
                width=original_size[0],
                height=original_size[1],
                status="ready",
            )

            print(f"[OK] Asset {asset_id} — thumbnail ready at {thumb_key}")
            processed.append(asset_id)

        except Exception as e:
            print(f"[ERROR] Failed processing {raw_key}: {e}")
            # Mark asset as error so the UI can show a failed state
            try:
                _update_asset_record(asset_id=asset_id, status="error")
            except Exception as db_err:
                print(f"[ERROR] Could not update error status: {db_err}")

    return {"processed": processed}


def _update_asset_record(asset_id: str, status: str,
                          thumb_key: str = None,
                          width: int = None,
                          height: int = None):
    """
    Write directly to RDS PostgreSQL via psycopg2.
    Lambda creates a new connection per invocation.
    (Connection pooling like PgBouncer is a Phase 2 concern.)
    """
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE assets
                SET    status      = %s,
                       thumb_key   = COALESCE(%s, thumb_key),
                       width       = COALESCE(%s, width),
                       height      = COALESCE(%s, height),
                       updated_at  = NOW()
                WHERE  id::text    = %s
                """,
                (status, thumb_key, width, height, asset_id),
            )
        conn.commit()
    finally:
        conn.close()
