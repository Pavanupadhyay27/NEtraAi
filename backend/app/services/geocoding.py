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
            try:
                data = response.json()
            except ValueError:
                logger.error(f"Geocoding received invalid JSON response for '{address}'")
                return None, None
            if data and len(data) > 0 and isinstance(data, list):
                first_match = data[0]
                if "lat" in first_match and "lon" in first_match:
                    return float(first_match["lat"]), float(first_match["lon"])
        else:
            logger.warning(f"Geocoding API returned status code {response.status_code} for '{address}'")
        return None, None
    except requests.exceptions.RequestException as req_err:
        logger.error(f"Network error geocoding address '{address}': {req_err}")
        return None, None
    except Exception as e:
        logger.error(f"Failed to geocode address '{address}': {e}")
        return None, None

def reverse_geocode(lat: float, lng: float) -> Optional[str]:
    """
    Convert Latitude and Longitude into a human-readable address.
    Returns the address string or None if not found.
    """
    if lat < -90.0 or lat > 90.0 or lng < -180.0 or lng > 180.0:
        logger.warning(f"Invalid coordinates passed to reverse geocode: {lat}, {lng}")
        return None
        
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
            try:
                data = response.json()
            except ValueError:
                logger.error(f"Reverse geocoding received invalid JSON response for coordinates ({lat}, {lng})")
                return None
            if isinstance(data, dict) and "display_name" in data:
                return data["display_name"]
        else:
            logger.warning(f"Reverse geocoding API returned status code {response.status_code} for ({lat}, {lng})")
        return None
    except requests.exceptions.RequestException as req_err:
        logger.error(f"Network error reverse geocoding ({lat}, {lng}): {req_err}")
        return None
    except Exception as e:
        logger.error(f"Failed to reverse geocode ({lat}, {lng}): {e}")
        return None
