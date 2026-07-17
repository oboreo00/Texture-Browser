from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://postgres:password@localhost:5432/texture_browser"

    # AWS
    aws_region: str = "us-east-1"
    s3_bucket_name: str = "texture-browser-assets"
    s3_raw_prefix: str = "textures/raw"
    s3_thumbs_prefix: str = "textures/thumbs"

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
