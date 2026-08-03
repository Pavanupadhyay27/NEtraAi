from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core import security
from app.models import models
from app.core.webpush_service import get_vapid_keys
from pydantic import BaseModel
import json

router = APIRouter()

class SubscriptionPayload(BaseModel):
    subscription: dict

@router.get("/vapid-public-key")
def get_public_key():
    pub_key, _ = get_vapid_keys()
    return {"publicKey": pub_key}

@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
def subscribe_user(
    payload: SubscriptionPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    sub_str = json.dumps(payload.subscription)
    
    # Check if subscription already registered
    existing = db.query(models.PushSubscription).filter(
        models.PushSubscription.user_id == current_user.id,
        models.PushSubscription.subscription_json == sub_str
    ).first()
    
    if not existing:
        new_sub = models.PushSubscription(
            user_id=current_user.id,
            subscription_json=sub_str
        )
        db.add(new_sub)
        db.commit()
        
    return {"message": "Subscribed successfully"}

@router.post("/unsubscribe")
def unsubscribe_user(
    payload: SubscriptionPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    sub_str = json.dumps(payload.subscription)
    db.query(models.PushSubscription).filter(
        models.PushSubscription.user_id == current_user.id,
        models.PushSubscription.subscription_json == sub_str
    ).delete()
    db.commit()
    return {"message": "Unsubscribed successfully"}
