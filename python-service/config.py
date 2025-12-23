from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://postgres@localhost:5432/rosbags"
    
    # Storage
    upload_dir: str = "/home/luukas/bagtest"
    
    # Processing
    max_concurrent_processing: int = 2
    frame_quality: int = 85  # JPEG quality 1-100
    
    # API
    host: str = "0.0.0.0"
    port: int = 8000
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# Ensure upload directory exists
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)