import json
from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache
from typing import Union


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

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, list[str]]) -> list[str]:
        if isinstance(v, str):
            try:
                # Try parsing JSON string e.g. ["a", "b"]
                return json.loads(v)
            except json.JSONDecodeError:
                # Fallback to comma-separated string e.g. a,b
                return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
