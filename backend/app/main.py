from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.database import Base, engine
from app.routes import assets

settings = get_settings()

# Create tables on startup (use Alembic for production migrations)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Texture Browser API",
    description="Game-studio asset ingestion pipeline — Phase 1",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assets.router)


@app.get("/health", tags=["system"])
def health_check():
    return {"status": "ok", "service": "texture-browser-api", "version": "0.1.0"}
