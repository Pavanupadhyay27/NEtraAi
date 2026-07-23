import os
from typing import List, Union
from pydantic import AnyHttpUrl, validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
load_dotenv(dotenv_path=env_path, override=True)




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
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15   # Short-lived — silent refresh handles renewal
    REFRESH_TOKEN_EXPIRE_DAYS: int = 1      # 24-hour refresh window
    # Set to True only if behind a trusted reverse proxy (nginx/Cloudflare) that sets X-Forwarded-For
    TRUST_PROXY: bool = False
    # Set to 'production' in .env to disable API docs and tighten other settings
    ENVIRONMENT: str = "development"
    
    # Seeding
    INITIAL_ADMIN_EMAIL: str = "pavanupadhyay027@gmail.com"
    INITIAL_ADMIN_PASSWORD: str = "Admin@NetraID2026"
    
    # Face recognition & liveness detection parameters
    KIOSK_FACE_THRESHOLD: float = 0.45
    KIOSK_LIVENESS_THRESHOLD: float = 0.55
    FORCE_MOCK_MODE: bool = False
    
    # Performance Optimizations
    LOW_MEMORY_MODE: bool = False  # Set to False on VPS/Dedicated servers to run faster
    ORT_INTRA_OP_NUM_THREADS: int = 0  # 0 = automatic core detection (faster)
    
    # Paths
    UPLOAD_DIR: str = "./uploads"
    MODELS_DIR: str = "./models"
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 200
    DISABLE_RATE_LIMIT: bool = False
    # Audit log retention in days (default: 90 days)
    AUDIT_LOG_RETENTION_DAYS: int = 90
    
    # CORS Origins
    # Comma-separated list of allowed origins, e.g. https://n-etra-ai-rjn3.vercel.app
    # CRITICAL: Do NOT set this to "*" in production — wildcard is incompatible with
    # allow_credentials=True and will break cookie-based auth (CORS spec requirement).
    ALLOWED_HOSTS: str = "*"

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins(self) -> List[str]:
        """
        Returns the list of allowed CORS origins.

        IMPORTANT: Never returns ["*"] — wildcard origins are incompatible with
        allow_credentials=True (CORS spec). When ALLOWED_HOSTS is "*" or unset,
        we fall back to the known static origin list so credentials still work.
        """
        # Known production origins — hardcoded here (not as a Pydantic field)
        # to avoid Pydantic v2 private attribute issues with underscore prefixes
        static_origins = [
            "https://n-etra-ai-rjn3.vercel.app",
            "https://netraai07-netra.hf.space",
            "https://pawankr007-netra.hf.space",
            "http://localhost:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:8000",
        ]
        extra: List[str] = []
        if self.ALLOWED_HOSTS and self.ALLOWED_HOSTS.strip() not in ("", "*"):
            extra = [o.strip() for o in self.ALLOWED_HOSTS.split(",") if o.strip()]
        # Merge static + configured origins, deduplicated
        combined = list(dict.fromkeys(static_origins + extra))
        return combined

    @property
    def cors_origin_regex(self) -> str:
        """Regex to allow all Vercel preview deployments for this project."""
        return r"https://n-etra-ai.*\.vercel\.app"


settings = Settings()
