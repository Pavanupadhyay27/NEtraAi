import threading
import time
import cv2
import base64
import httpx
import logging
from app.core.config import settings
from app.core.database import SessionLocal
from app.crud import crud

logger = logging.getLogger("RTSPProcessor")

class RTSPStreamProcessor:
    def __init__(self):
        self.thread = None
        self.running = False
        
    def start(self):
        db = SessionLocal()
        try:
            enabled_setting = crud.get_setting_by_key(db, "RTSP_STREAM_ENABLED")
            enabled = enabled_setting.value.lower() == "true" if enabled_setting else False
            
            url_setting = crud.get_setting_by_key(db, "RTSP_STREAM_URL")
            url = url_setting.value if url_setting else ""
            
            if not enabled:
                logger.info("RTSP Stream Processor is disabled in settings.")
                return
                
            if not url:
                logger.warning("RTSP Stream Processor is enabled but RTSP_STREAM_URL is empty.")
                return
                
            self.running = True
            self.thread = threading.Thread(target=self._run_loop, args=(url,), daemon=True)
            self.thread.start()
            logger.info(f"RTSP Stream Processor started for URL: {url}")
        except Exception as e:
            logger.error(f"Error starting RTSP processor: {e}")
        finally:
            db.close()

    def stop(self):
        self.running = False
        if self.thread:
            try:
                self.thread.join(timeout=1.5)
            except Exception as e:
                logger.warning(f"Error joining RTSP thread: {e}")
            self.thread = None
            logger.info("RTSP Stream Processor stopped.")

    def _run_loop(self, rtsp_url):
        # We periodically capture and post frames to the local scan API endpoint
        # Local endpoint URL:
        scan_url = f"http://127.0.0.1:8000{settings.API_V1_STR}/kiosk/scan"
        
        while self.running:
            logger.info(f"Connecting to RTSP video stream: {rtsp_url}")
            cap = cv2.VideoCapture(rtsp_url)
            
            if not cap.isOpened():
                logger.error("Failed to open RTSP stream. Retrying in 15 seconds...")
                time.sleep(15)
                continue
                
            last_process_time = 0
            # Process a frame every 1.5 seconds to limit CPU load and duplicate logs
            process_interval = 1.5
            
            with httpx.Client() as client:
                while self.running:
                    ret, frame = cap.read()
                    if not ret:
                        logger.warning("Lost connection to RTSP stream. Reconnecting...")
                        break
                        
                    now = time.time()
                    if now - last_process_time >= process_interval:
                        last_process_time = now
                        
                        try:
                            # Encode frame as JPEG base64
                            _, buffer = cv2.imencode('.jpg', frame)
                            img_base64 = base64.b64encode(buffer).decode('utf-8')
                            payload_image = f"data:image/jpeg;base64,{img_base64}"
                            
                            # Post to scan endpoint
                            response = client.post(
                                scan_url,
                                json={
                                    "image": payload_image,
                                    "camera": "RTSP IP Camera",
                                    "confirm_checkout": True # Auto-confirm checkout for CCTV clockings
                                },
                                timeout=5.0
                            )
                            
                            if response.status_code == 200:
                                data = response.json()
                                if data.get("status") == "success":
                                    emp = data.get("employee", {})
                                    logger.info(f"RTSP Match Success: {emp.get('name')} ({emp.get('employee_id')})")
                            else:
                                logger.warning(f"RTSP scan endpoint returned code {response.status_code}: {response.text}")
                        except Exception as e:
                            logger.error(f"Error posting RTSP frame to scan endpoint: {e}")
                        
                # Sleep tiny duration to keep loop efficient
                time.sleep(0.01)
                
            cap.release()
            if self.running:
                time.sleep(5) # Reconnect backoff
