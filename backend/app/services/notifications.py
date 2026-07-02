import httpx
import threading
import logging
from app.crud import crud

logger = logging.getLogger("Notifications")

def _post_webhook(url: str, payload: dict):
    try:
        response = httpx.post(url, json=payload, timeout=5)
        if response.status_code not in (200, 201, 204):
            logger.warning(f"Webhook alert failed with status code {response.status_code}: {response.text}")
    except Exception as e:
        logger.error(f"Error posting alert webhook: {e}")

def trigger_security_alert(db, alert_type: str, details: dict):
    """
    Asynchronously dispatches a webhook notification if NOTIFICATION_WEBHOOK_URL is configured.
    """
    try:
        url_setting = crud.get_setting_by_key(db, "NOTIFICATION_WEBHOOK_URL")
        webhook_url = url_setting.value.strip() if url_setting else ""
        
        if not webhook_url:
            return
            
        # Format the notification based on destination
        payload = {}
        
        if "slack.com" in webhook_url:
            payload = {
                "text": f"🚨 *NetraID Security Alert:* {alert_type}",
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"🚨 *NetraID Security Alert:* {alert_type}"
                        }
                    },
                    {
                        "type": "section",
                        "fields": [
                            {"type": "mrkdwn", "text": f"*Device:* {details.get('camera', 'Unknown')}"},
                            {"type": "mrkdwn", "text": f"*Confidence:* {details.get('confidence', 0.0):.2f}"},
                            {"type": "mrkdwn", "text": f"*Liveness Score:* {details.get('liveness_score', 0.0):.2f}"},
                            {"type": "mrkdwn", "text": f"*Timestamp:* {details.get('timestamp', '')}"}
                        ]
                    }
                ]
            }
        elif "discord.com" in webhook_url:
            payload = {
                "content": f"🚨 **NetraID Security Alert:** {alert_type}",
                "embeds": [{
                    "title": "Security Log Triggered",
                    "color": 15158332, # Red
                    "fields": [
                        {"name": "Incident", "value": alert_type, "inline": True},
                        {"name": "Camera Device", "value": details.get('camera', 'Unknown'), "inline": True},
                        {"name": "Liveness Score", "value": f"{details.get('liveness_score', 0.0):.2f}", "inline": True},
                        {"name": "Confidence", "value": f"{details.get('confidence', 0.0):.2f}", "inline": True},
                        {"name": "Timestamp", "value": details.get('timestamp', ''), "inline": False}
                    ]
                }]
            }
        else:
            # Generic webhook payload
            payload = {
                "event": "security_alert",
                "alert_type": alert_type,
                "details": details
            }
            
        # Fire request asynchronously in a background daemon thread
        threading.Thread(target=_post_webhook, args=(webhook_url, payload), daemon=True).start()
        logger.info(f"Security alert '{alert_type}' dispatched to webhook.")
    except Exception as e:
        logger.error(f"Failed to trigger security alert: {e}")
