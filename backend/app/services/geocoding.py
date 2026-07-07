import requests
import logging
from typing import Optional, Tuple

logger = logging.getLogger("Geocoding")

# Nominatim strictly requires a unique User-Agent
HEADERS = {
    "User-Agent": "NetraID-Attendance-System/1.0 (contact@netraid.com)"
}

def geocode_address(address: str) -> Tuple[Optional[float], Optional[float]]:
    """
    Convert a human-readable address into Latitude and Longitude using Nominatim.
    Returns (lat, lng) or (None, None) if not found.
    """
    if not address or not address.strip():
        return None, None
        
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": address,
            "format": "json",
            "limit": 1
        }
        response = requests.get(url, params=params, headers=HEADERS, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                return float(data[0]["lat"]), float(data[0]["lon"])
        return None, None
    except Exception as e:
        logger.error(f"Failed to geocode address '{address}': {e}")
        return None, None

def reverse_geocode(lat: float, lng: float) -> Optional[str]:
    """
    Convert Latitude and Longitude into a human-readable address.
    Returns the address string or None if not found.
    """
    try:
        url = "https://nominatim.openstreetmap.org/reverse"
        params = {
            "lat": lat,
            "lon": lng,
            "format": "json",
            "zoom": 18,
            "addressdetails": 1
        }
        response = requests.get(url, params=params, headers=HEADERS, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if "display_name" in data:
                return data["display_name"]
        return None
    except Exception as e:
        logger.error(f"Failed to reverse geocode ({lat}, {lng}): {e}")
        return None
