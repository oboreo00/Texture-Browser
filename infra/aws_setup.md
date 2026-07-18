# AWS Setup Guide — Texture Browser Phase 1

Step-by-step instructions for setting up every AWS resource on a **new free-tier account**.
Follow these in order — each step depends on the previous.

---

## 0. Before You Start

- Install AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html
- Run `aws configure` and enter your Access Key ID, Secret, region (`us-east-1`), and output format (`json`)

---

## 1. S3 Bucket

**What**: One bucket, two prefixes — `textures/raw/` for uploads, `textures/thumbs/` for Lambda output.

### Steps (AWS Console)
1. Go to **S3** → **Create bucket**
2. Name: `texture-browser-assets` (must be globally unique — append your name if taken e.g. `texture-browser-assets-yourname`)
3. Region: `us-east-1`
4. **Block all public access**: ✅ KEEP BLOCKED (we use pre-signed URLs, not public access)
5. Leave all other settings default → **Create bucket**

### CORS config (needed so the browser can PUT directly to S3)
After creation → **Permissions** tab → **Cross-origin resource sharing (CORS)** → Edit:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:5173",
      "http://YOUR_EC2_PUBLIC_IP"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

---

## 2. RDS PostgreSQL (Free Tier)

**What**: RDS = Relational Database Service. You're renting a managed Postgres server.
t3.micro = 1 vCPU, 1 GB RAM. Free for 750 hrs/month for 12 months.

### Steps (AWS Console)
1. Go to **RDS** → **Create database**
2. Engine: **PostgreSQL** (latest version)
3. Template: **Free tier** (this auto-selects t3.micro)
4. DB identifier: `texture-browser`
5. Master username: `postgres`
6. Master password: choose a strong password, save it
7. Instance class: `db.t3.micro` (auto-selected by Free tier)
8. Storage: 20 GB gp2 (free tier default)
9. **Connectivity**:
   - VPC: default
   - Public access: **Yes** (for Phase 1 simplicity — lock this down in Phase 2)
   - VPC security group: Create new → name it `texture-browser-rds-sg`
10. **Create database** (takes ~5 minutes)

### After creation
- Note the **Endpoint** (looks like `texture-browser.abc123.us-east-1.rds.amazonaws.com`)

- Go to the security group → **Inbound rules** → Add rule:
  - Type: PostgreSQL, Port: 5432
  - Source: your EC2 security group (or your IP for local dev)

### Update your .env
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@texture-browser.abc123.us-east-1.rds.amazonaws.com:5432/postgres
```

---

## 3. EC2 t3.micro (FastAPI Server)

**What**: EC2 = virtual server in the cloud. t3.micro = the smallest/cheapest size. Free for 750 hrs/month.

### Steps (AWS Console)
1. Go to **EC2** → **Launch instance**
2. Name: `texture-browser-api`
3. AMI: **Amazon Linux 2023** (free tier eligible)
4. Instance type: `t3.micro`
5. Key pair: Create new → name `texture-browser-key` → download the `.pem` file → **keep it safe**
6. Security group: Create new → name `texture-browser-ec2-sg`
   - Inbound rules:
     - SSH: Port 22, Source: My IP
     - HTTP: Port 80, Source: 0.0.0.0/0
     - Custom TCP: Port 8000, Source: 0.0.0.0/0 (for dev — restrict later)
7. **Launch instance**

### SSH into your EC2 instance
```bash
chmod 400 ~/Downloads/texture-browser-key.pem
ssh -i ~/Downloads/texture-browser-key.pem ec2-user@YOUR_EC2_PUBLIC_IP
```

### Run the EC2 setup script
```bash
# On your EC2 instance:
sudo dnf update -y
sudo dnf install python3-pip python3-devel gcc postgresql-devel nginx -y

# Create app directory
mkdir -p ~/texture-browser/backend
cd ~/texture-browser/backend

# Upload your backend code (from your local machine):
# scp -i ~/Downloads/texture-browser-key.pem -r ./backend/* ec2-user@YOUR_IP:~/texture-browser/backend/

pip3 install --user virtualenv
python3 -m venv .venv
source .venv/bin/activate
pip3 install -r requirements.txt

cp .env.example .env
nano .env   # Fill in DATABASE_URL (RDS with ?sslmode=require) and S3_BUCKET_NAME

# Run FastAPI in production (without --reload)
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Nginx reverse proxy (optional for Phase 1)
```nginx
# /etc/nginx/conf.d/texture-browser.conf
server {
    listen 80;
    server_name YOUR_EC2_PUBLIC_IP;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
```bash
sudo systemctl start nginx
sudo systemctl enable nginx
```

---

## 4. IAM Roles

### 4a. EC2 IAM Role (allows FastAPI to generate S3 pre-signed URLs)
1. Go to **IAM** → **Roles** → **Create role**
2. Trusted entity: **EC2**
3. Attach policy: **AmazonS3FullAccess** (scope this down in Phase 2)
4. Name: `texture-browser-ec2-role`
5. Attach to your EC2 instance:
   * Go to the **EC2 console** → **Instances** → check your instance.
   * Click **Actions** (top right) → **Security** → **Modify IAM role**.
   * In the dropdown, select the newly created `texture-browser-ec2-role`.
   * Click the blue **Update IAM role** (or **Save**) button to apply changes.

### 4b. Lambda Execution Role (allows Lambda to read/write S3 and connect to RDS)
1. **IAM** → **Roles** → **Create role**
2. Trusted entity: **Lambda**
3. Attach policies:
   - `AWSLambdaBasicExecutionRole` (CloudWatch logs)
   - `AmazonS3FullAccess`
   - `AmazonRDSFullAccess` (or just VPC access if RDS is in VPC)
4. Name: `texture-browser-lambda-role`

---

## 5. Lambda Function (Thumbnail Generator)

### Steps (AWS Console)
1. Go to **Lambda** → **Create function**
2. Name: `texture-browser-thumbnail`
3. Runtime: **Python 3.12**
4. Execution role: **Use existing** → `texture-browser-lambda-role`
5. **Create function**

### Upload the code
Pillow is not included in the Lambda runtime — you must package it as a ZIP with dependencies:

```bash
cd lambda/thumbnail_generator
pip install -r requirements.txt -t ./package
cp handler.py ./package/
cd package
zip -r ../thumbnail_generator.zip .
```

In the Lambda console → **Upload from** → **.zip file** → upload `thumbnail_generator.zip`

### Set environment variables (Lambda console → Configuration → Environment variables)
```
S3_BUCKET_NAME    = texture-browser-assets
S3_THUMBS_PREFIX  = textures/thumbs
DATABASE_URL      = postgresql://postgres:PASSWORD@YOUR_RDS_ENDPOINT:5432/postgres
```

### Increase memory + timeout
Lambda → Configuration → General configuration:
- Memory: **512 MB** (Pillow needs it for large textures)
- Timeout: **30 seconds**

### Wire S3 → Lambda trigger
Lambda → **Add trigger** → **S3**:
- Bucket: `texture-browser-assets`
- Event type: **All object create events**
- Prefix: `textures/raw/`
- **Add**

---

## 6. Test the full pipeline

```bash
# From local machine — test FastAPI health
curl http://YOUR_EC2_PUBLIC_IP:8000/health

# Upload a texture via FastAPI
curl -X POST "http://YOUR_EC2_PUBLIC_IP:8000/assets/upload-url?filename=test.png&file_size=12345"
# → Returns { asset_id, upload_url, raw_key }

# PUT the file directly to S3 using the presigned URL
curl -X PUT "PRESIGNED_URL" --upload-file ./test.png -H "Content-Type: image/png"

# Check processing status (Lambda should fire within seconds)
curl "http://YOUR_EC2_PUBLIC_IP:8000/assets/ASSET_ID"
# → status: "processing" then "ready"

# Get the thumbnail URL
curl "http://YOUR_EC2_PUBLIC_IP:8000/assets/ASSET_ID/thumb-url"
```

---

## Cost Summary (Free Tier)

| Service | Free Tier | Notes |
|---------|-----------|-------|
| EC2 t3.micro | 750 hrs/month for 12 months | ~$0 |
| RDS PostgreSQL t3.micro | 750 hrs/month for 12 months | ~$0 |
| S3 | 5 GB storage, 2K PUT, 20K GET | ~$0 for demo |
| Lambda | 1M requests/month forever | ~$0 |
| Data transfer | 100 GB/month out | ~$0 for demo |

> ⚠️ **Stop your RDS and EC2 instances when not actively developing** to avoid accidentally burning free-tier hours.
