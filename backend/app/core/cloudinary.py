import os
import requests
import logging

logger = logging.getLogger(__name__)

# Sandbox fallback so it works out-of-the-box on Hugging Face
DEFAULT_CLOUD_NAME = "dju1idg8n"
DEFAULT_PRESET = "netraid_preset"

def upload_to_cloudinary(file_content: bytes, filename: str) -> str:
    """
    Uploads a file directly to Cloudinary using their REST API (unsigned upload preset).
    Returns the secure HTTPS URL of the uploaded asset, or None if failed.
    """
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", DEFAULT_CLOUD_NAME)
    preset = os.getenv("CLOUDINARY_UPLOAD_PRESET", DEFAULT_PRESET)
    
    if not cloud_name or not preset:
        logger.warning("Cloudinary credentials not set and no default preset available.")
        return None
        
    try:
        url = f"https://api.cloudinary.com/v1_1/{cloud_name}/auto/upload"
        files = {"file": (filename, file_content)}
        data = {"upload_preset": preset}
        
        logger.info(f"Uploading {filename} to Cloudinary cloud: {cloud_name}...")
        response = requests.post(url, files=files, data=data, timeout=30)
        
        if response.status_code == 200:
            res_data = response.json()
            secure_url = res_data.get("secure_url")
            logger.info(f"Cloudinary upload successful: {secure_url}")
            return secure_url
        else:
            logger.error(f"Cloudinary upload failed with code {response.status_code}: {response.text}")
            return None
    except Exception as e:
        logger.error(f"Exception during Cloudinary upload: {str(e)}")
        return None
