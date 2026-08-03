import os
import json
import logging
from pywebpush import webpush, WebPushException

logger = logging.getLogger(__name__)

VAPID_FILE = "vapid_keys.json"

STATIC_PUBLIC_KEY = "BERCOf8jy0h2uFund_WMLVClCm5T264hpuIF5lfutNfWCvljGfeDtJOszHaQh8N6cj3y8eJi8X2V_MLene7lsIQ"
STATIC_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgd98TRydLeHCpu8Ee\nb6RZGbTO7vTLUaC+eCaHp2ER6d2hRANCAAREQjn/I8tIdrhbp3f1jC1QpQpuU9uu\nIabiBeZX7rTX1gr5Yxn3g7STrMx2kIfDenI98vHiYvF9lfzC3p3u5bCE\n-----END PRIVATE KEY-----\n"

def get_vapid_keys():
    """
    Returns (public_key, private_key) as string.
    Checks environment, local file, and falls back to persistent static keypair.
    """
    pub = os.getenv("VAPID_PUBLIC_KEY")
    priv = os.getenv("VAPID_PRIVATE_KEY")
    if pub and priv:
        return pub, priv

    if os.path.exists(VAPID_FILE):
        try:
            with open(VAPID_FILE, "r") as f:
                data = json.load(f)
                return data.get("public_key"), data.get("private_key")
        except Exception as e:
            logger.error(f"Error reading VAPID file: {str(e)}")

    return STATIC_PUBLIC_KEY, STATIC_PRIVATE_KEY

def send_web_push(subscription_info: dict, title: str, message: str, url: str = "/"):
    """
    Sends a web push notification to a specific user subscription.
    Returns:
       - True if success
       - 'expired' if the subscription is stale (404/410) and should be deleted
       - False for other errors
    """
    pub_key, priv_key = get_vapid_keys()
    
    payload = {
        "title": title,
        "message": message,
        "url": url
    }
    
    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=priv_key,
            vapid_claims={
                "sub": os.getenv("VAPID_ADMIN_EMAIL", "mailto:pavanupadhyay027@gmail.com")
            }
        )
        logger.info("Web push notification sent successfully.")
        return True
    except WebPushException as ex:
        logger.warning(f"WebPushException sending notification: {str(ex)}")
        if ex.response is not None and ex.response.status_code in [404, 410]:
            logger.info("Subscription is expired or gone. Marking for deletion.")
            return "expired"
        return False
    except Exception as e:
        logger.error(f"Error sending web push: {str(e)}")
        return False


def send_notification_to_user(db, user_id: int, title: str, message: str, url: str = "/"):
    """
    Finds all active push subscriptions for a user and triggers web pushes.
    Prunes expired subscriptions automatically.
    """
    from app.models import models
    subscriptions = db.query(models.PushSubscription).filter(
        models.PushSubscription.user_id == user_id
    ).all()
    
    for sub in subscriptions:
        try:
            sub_info = json.loads(sub.subscription_json)
            result = send_web_push(sub_info, title, message, url)
            if result == "expired":
                logger.info(f"Removing expired subscription ID {sub.id} for user {user_id}")
                db.delete(sub)
        except Exception as e:
            logger.error(f"Error processing subscription ID {sub.id}: {str(e)}")
            
    db.commit()
