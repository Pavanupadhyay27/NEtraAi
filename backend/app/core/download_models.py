import os
import urllib.request
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("ModelDownloader")

MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "models"))

MODEL_URLS = {
    # SCRFD Face Detector (2.5G is fast and accurate enough for VPS)
    "det_2.5g.onnx": "https://huggingface.co/immich-app/buffalo_m/resolve/main/detection/model.onnx",
    # ArcFace Face Recognition (w600k_r50)
    "w600k_r50.onnx": "https://huggingface.co/immich-app/buffalo_m/resolve/main/recognition/model.onnx",
    # Silent-Face-Anti-Spoofing ONNX models (2.7k_80x80)
    "2.7k_80x80.onnx": "https://raw.githubusercontent.com/QingHeYang/Silent-Face-Anti-Spoofing-onnx/main/onnx/2.7_80x80_MiniFASNetV2.onnx"
}

def download_file(url: str, dest_path: str):
    logger.info(f"Downloading {url} to {dest_path}...")
    try:
        def progress(count, block_size, total_size):
            percent = int(count * block_size * 100 / total_size)
            if percent % 10 == 0:
                logger.info(f"Progress: {percent}%")
        
        urllib.request.urlretrieve(url, dest_path, reporthook=progress)
        logger.info(f"Successfully downloaded {dest_path}")
    except Exception as e:
        logger.error(f"Failed to download {url}: {e}")
        # If it fails, we touch/create a small file so the backend can run in mock mode
        # or we throw an exception. For production resilience, we log it.
        raise e

def download_all_models():
    os.makedirs(MODELS_DIR, exist_ok=True)
    
    for filename, url in MODEL_URLS.items():
        dest_path = os.path.join(MODELS_DIR, filename)
        if os.path.exists(dest_path) and os.path.getsize(dest_path) > 1024 * 1024:
            logger.info(f"{filename} already exists and is valid. Skipping download.")
        else:
            try:
                download_file(url, dest_path)
            except Exception as e:
                logger.warning(f"Could not download {filename} from remote. Ensure you place it in {MODELS_DIR} manually. Error: {e}")

if __name__ == "__main__":
    download_all_models()
