import base64
import boto3
import io
import json
import os
import urllib.request
import urllib.error
import psycopg2
from PIL import Image

# ── Config from Lambda environment variables ──────────────────────────────────
BUCKET_NAME   = os.environ["S3_BUCKET_NAME"]
THUMBS_PREFIX = os.environ.get("S3_THUMBS_PREFIX", "textures/thumbs")
THUMB_SIZE    = (512, 512)   # max width × height — preserves aspect ratio
THUMB_QUALITY = 85           # WebP quality (85 = great balance of size/clarity)
DATABASE_URL  = os.environ["DATABASE_URL"]
# Format: postgresql://user:password@host:5432/dbname
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")


def _get_ai_tags(image_bytes: bytes) -> list:
    """
    Calls Gemini 2.5 Flash API with the WebP image bytes and requests 3-4 descriptive tags.
    """
    if not GEMINI_API_KEY:
        print("[WARNING] GEMINI_API_KEY not found in environment. Skipping AI tagging.")
        return []

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    
    # Base64 encode WebP thumbnail
    b64_image = base64.b64encode(image_bytes).decode("utf-8")
    
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": "Analyze this texture image and return a JSON list of 3-4 descriptive tags specifying material type, style, color, pattern, or usage (e.g. ['brick', 'rough', 'red', 'seamless']). Return ONLY a raw JSON array of strings, nothing else."
                    },
                    {
                        "inlineData": {
                            "mimeType": "image/webp",
                            "data": b64_image
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            text_response = res_data["candidates"][0]["content"]["parts"][0]["text"]
            tags = json.loads(text_response.strip())
            if isinstance(tags, list):
                return [str(t).strip().lower() for t in tags if t][:4]
    except Exception as e:
        print(f"[WARNING] Failed to fetch AI tags from Gemini: {e}")
    
    return []


def lambda_handler(event, context):
    """
    Triggered by: S3 ObjectCreated event on textures/raw/*
    
    Flow:
      1. Parse the S3 key from the event
      2. Download the raw texture from S3
      3. Generate a 512×512 WebP thumbnail with Pillow
      4. Write the thumbnail back to S3 at textures/thumbs/{uuid}/thumb.webp
      5. Call Gemini 2.5 Flash to generate 3-4 tags
      6. Update the RDS asset record: thumb_key, tags, status='ready'
    
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
            thumb_bytes = buf.getvalue()
            thumb_len = len(thumb_bytes)

            # ── 4. Upload thumbnail to S3 ─────────────────────────────────────
            print(f"[INFO] Writing thumbnail to s3://{bucket}/{thumb_key} ({thumb_len} bytes)")
            s3.put_object(
                Bucket=bucket,
                Key=thumb_key,
                Body=io.BytesIO(thumb_bytes),
                ContentType="image/webp",
            )

            # ── 5. Generate AI Tags ───────────────────────────────────────────
            print(f"[INFO] Generating AI tags for asset {asset_id} using Gemini...")
            tags = _get_ai_tags(thumb_bytes)
            print(f"[INFO] Generated tags: {tags}")

            # ── 6. Update RDS record ──────────────────────────────────────────
            _update_asset_record(
                asset_id=asset_id,
                thumb_key=thumb_key,
                width=original_size[0],
                height=original_size[1],
                status="ready",
                tags=tags,
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
                          height: int = None,
                          tags: list = None):
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
                       tags        = COALESCE(%s, tags),
                       updated_at  = NOW()
                WHERE  id::text    = %s
                """,
                (status, thumb_key, width, height, tags, asset_id),
            )
        conn.commit()
    finally:
        conn.close()
