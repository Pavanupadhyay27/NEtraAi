import os
import json
import logging
from pywebpush import webpush, WebPushException

logger = logging.getLogger(__name__)

VAPID_FILE = "vapid_keys.json"

def get_vapid_keys():
    """
    Returns (public_key, private_key) as string.
    Generates them dynamically if they are not defined in the environment.
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

    # Generate EC VAPID keys on the fly using standard cryptography library
    try:
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.primitives import serialization
        import base64

        private_key = ec.generate_private_key(ec.SECP256R1())
        
        # Uncompressed point format public key
        pub_bytes = private_key.public_key().public_bytes(
            encoding=serialization.Encoding.X962,
            format=serialization.PublicFormat.UncompressedPoint
        )
        b64_public_key = base64.urlsafe_b64encode(pub_bytes).decode('utf-8').rstrip('=')

        pem_private_key = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ).decode('utf-8')

        with open(VAPID_FILE, "w") as f:
            json.dump({"public_key": b64_public_key, "private_key": pem_private_key}, f)

        logger.info("Successfully generated new VAPID keys.")
        return b64_public_key, pem_private_key
    except Exception as e:
        logger.error(f"Failed to generate VAPID keys dynamically: {str(e)}")
        # Ultimate mock fallback to prevent app crashes if cryptography is unavailable
        return "BEl42c...", "-----BEGIN PRIVATE KEY-----..."

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
