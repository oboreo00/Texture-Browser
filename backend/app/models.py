import uuid
from datetime import datetime
from sqlalchemy import Column, String, BigInteger, TIMESTAMP, ARRAY, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base


class Asset(Base):
    __tablename__ = "assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String(255), nullable=False)
    original_extension = Column(String(20))           # png, jpg, tga
    raw_key = Column(Text, nullable=False)            # textures/raw/{uuid}/{filename}
    thumb_key = Column(Text, nullable=True)           # textures/thumbs/{uuid}/thumb.webp
    file_size = Column(BigInteger, nullable=True)     # bytes
    mime_type = Column(String(100), nullable=True)
    width = Column(BigInteger, nullable=True)          # original texture width (px)
    height = Column(BigInteger, nullable=True)         # original texture height (px)
    status = Column(String(20), nullable=False, default="processing")
    # status values: processing | ready | error
    tags = Column(ARRAY(Text), nullable=True)          # Phase 2: Rekognition AI tags
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())
