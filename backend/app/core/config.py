import os
from typing import List, Union
from pydantic import AnyHttpUrl, validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "NetraID AI Face Attendance"
    API_V1_STR: str = "/api/v1"
    
    # Database Configuration
    DATABASE_URL: str
    
    @validator("DATABASE_URL", pre=True)
    def normalize_database_url(cls, v):
        import urllib.parse
        if not isinstance(v, str):
            return v
        
        if v.startswith("postgresql://") or v.startswith("postgres://"):
            prefix = "postgresql://" if v.startswith("postgresql://") else "postgres://"
            rest = v[len(prefix):]
            if "@" in rest:
                creds, host_info = rest.rsplit("@", 1)
                if ":" in creds:
                    user, password = creds.split(":", 1)
                else:
                    user = creds
                    password = ""
                
                # Auto-append project ref for Supabase pooler if missing
                if "pooler.supabase.com" in host_info:
                    if user == "postgres":
                        user = "postgres.erzowqgbpeobbzpjkmtt"
                
                # Auto-encode password safely
                decoded_password = urllib.parse.unquote(password)
                encoded_password = urllib.parse.quote_plus(decoded_password)
                
                v = f"postgresql://{user}:{encoded_password}@{host_info}"
        return v

    # JWT & Security
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Seeding
    INITIAL_ADMIN_EMAIL: str = "admin@netraid.ai"
    INITIAL_ADMIN_PASSWORD: str = "Admin@NetraID2026"
    
    # Face recognition & liveness detection parameters
    KIOSK_FACE_THRESHOLD: float = 0.60
    KIOSK_LIVENESS_THRESHOLD: float = 0.75
    FORCE_MOCK_MODE: bool = False
    
    # Paths
    UPLOAD_DIR: str = "./uploads"
    MODELS_DIR: str = "./models"
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 100
    
    # CORS Origins
    # We load them as a list of strings
    ALLOWED_HOSTS: str = "*"

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins(self) -> List[str]:
        if not self.ALLOWED_HOSTS:
            return ["*"]
        return [origin.strip() for origin in self.ALLOWED_HOSTS.split(",")]

settings = Settings()
