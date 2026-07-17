# Texture Browser

Game-studio asset ingestion pipeline. Upload textures → S3 → Lambda generates thumbnails → browse in a dark-mode React UI.

**Stack**: React + Tailwind · FastAPI (EC2 t3.micro) · Lambda (Pillow) · RDS PostgreSQL · S3

---

## Local Development

### Prerequisites

| Tool | Install |
|------|---------|
| Python 3.12+ | `brew install python` |
| Node 18+ | `brew install node` |
| PostgreSQL 16 | `brew install postgresql@16` |
| AWS CLI | `brew install awscli` |

### 1 — Database

```bash
brew services start postgresql@16
createdb texture_browser
```

### 2 — Backend (FastAPI)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # fill in your values
uvicorn app.main:app --reload
# → http://localhost:8000
# → http://localhost:8000/docs  (Swagger UI)
```

### 3 — Frontend (React + Tailwind)

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

> Both servers must be running at the same time. Vite proxies `/api/*` → `localhost:8000` automatically.

### 4 — AWS credentials

```bash
aws configure
# Enter your IAM user keys (not root)
aws sts get-caller-identity   # verify
```

---

## Architecture

```
React (localhost:5173)
  │
  ├── POST /api/assets/upload-url  ──▶  FastAPI (localhost:8000)
  │                                          │
  │   ◀── presigned S3 URL ─────────────────┘
  │
  └── PUT file ──────────────────────────▶  S3 (textures/raw/)
                                                │
                                         S3 Event fires
                                                │
                                         Lambda (Python)
                                           Pillow thumbnail
                                                │
                              ┌─────────────────┴─────────────────┐
                         S3 (textures/thumbs/)          RDS PostgreSQL
                                                    (status = 'ready')
```

---

## Project Structure

```
Texture-Browser/
├── frontend/                  # React + Tailwind + Vite
│   └── src/
│       ├── api/client.ts      # Axios wrapper + types
│       ├── components/        # UploadZone, AssetGrid, AssetCard, UploadProgress
│       └── hooks/             # useAssetStatus, usePipelineHealth
│
├── backend/                   # FastAPI on EC2 t3.micro
│   └── app/
│       ├── main.py            # FastAPI app entry
│       ├── models.py          # Asset ORM model
│       ├── schemas.py         # Pydantic request/response types
│       ├── routes/assets.py   # All endpoints
│       └── services/          # S3 presigned URL logic
│
├── lambda/
│   └── thumbnail_generator/
│       └── handler.py         # S3-triggered Pillow → WebP thumbnail
│
└── infra/
    └── aws_setup.md           # Step-by-step AWS console setup guide
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/assets/upload-url` | Get S3 presigned upload URL |
| `GET` | `/assets` | List all assets (paginated) |
| `GET` | `/assets/{id}` | Get single asset + status |
| `GET` | `/assets/{id}/thumb-url` | Get presigned thumbnail URL |
| `DELETE` | `/assets/{id}` | Delete asset + S3 objects |

---

## AWS Setup

See **[infra/aws_setup.md](infra/aws_setup.md)** for step-by-step instructions to create:
- S3 bucket + CORS config
- RDS PostgreSQL t3.micro (free tier)
- EC2 t3.micro + Nginx
- Lambda function + S3 event trigger
- IAM roles

## Phase Roadmap

- **Phase 1** ✅ Upload → S3 → Lambda thumbnail → RDS → Browser
- **Phase 2** — AI tags (AWS Rekognition), CloudFront CDN, search/filter
- **Phase 3** — Auth (Cognito), asset versioning, team permissions
