import datetime
from sqlalchemy.orm import Session
from app.crud import crud
from app.models import models
import math

class AttendancePolicyEngine:
    @staticmethod
    def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        # Haversine formula to compute distance in meters
        R = 6371000  # Earth radius in meters
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        
        a = math.sin(delta_phi / 2) ** 2 + \
            math.cos(phi1) * math.cos(phi2) * \
            math.sin(delta_lambda / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    @classmethod
    def evaluate_attendance(
        cls, 
        db: Session, 
        employee: models.Employee, 
        lat: float = None, 
        lng: float = None,
        confidence: float = None
    ) -> dict:
        company_id = employee.company_id
        now = datetime.datetime.now()
        today = now.date()

        # 1. Fetch matching settings
        threshold_setting = crud.get_setting(db, "face_match_threshold", company_id)
        match_threshold = float(threshold_setting.value) if threshold_setting else 0.6
        
        geofence_lat_setting = crud.get_setting(db, "office_latitude", company_id)
        geofence_lng_setting = crud.get_setting(db, "office_longitude", company_id)
        geofence_radius_setting = crud.get_setting(db, "geofence_radius_meters", company_id)

        # 2. Confidence Validation
        if confidence is not None and confidence < match_threshold:
            return {"allowed": False, "reason": "Biometric match confidence score below threshold requirement."}

        # 3. Geofence Validation
        geofence_result = "Passed"
        if geofence_lat_setting and geofence_lng_setting and geofence_radius_setting:
            try:
                target_lat = float(geofence_lat_setting.value)
                target_lng = float(geofence_lng_setting.value)
                allowed_radius = float(geofence_radius_setting.value)
                
                if lat is not None and lng is not None:
                    distance = cls.calculate_distance(lat, lng, target_lat, target_lng)
                    if distance > allowed_radius:
                        if not employee.allow_wfh:
                            return {"allowed": False, "reason": f"Outside authorized geofenced perimeter. Distance: {int(distance)}m."}
                        geofence_result = f"WFH Approved ({int(distance)}m)"
                else:
                    if not employee.allow_wfh:
                        return {"allowed": False, "reason": "GPS coordinates not supplied by kiosk terminal."}
                    geofence_result = "WFH Approved (No GPS)"
            except ValueError:
                pass

        # 4. Duplicate Check (within 5 minutes)
        recent_log = crud.get_attendance_by_employee_and_date(db, employee_id=employee.id, attendance_date=today)
        if recent_log and recent_log.check_in:
            time_since_checkin = (now - recent_log.check_in).total_seconds()
            if time_since_checkin < 300: # 5 minutes
                return {"allowed": False, "reason": "Duplicate swipe attempt blocked. Please wait 5 minutes."}

        # 5. Shift & Grace Period Rule Evaluation
        late_minutes = 0
        early_exit_minutes = 0
        overtime_hours = 0.0
        status = "Present"
        
        shift = employee.shift
        shift_info = "Default Shift"
        if shift:
            shift_info = f"{shift.name} ({shift.start_time.strftime('%H:%M')} - {shift.end_time.strftime('%H:%M')})"
            # Combine today's date with shift times
            shift_start = datetime.datetime.combine(today, shift.start_time)
            shift_end = datetime.datetime.combine(today, shift.end_time)
            
            # Check-in evaluation (Late arrival check)
            if not recent_log: # First check-in of the day
                grace_limit = shift_start + datetime.timedelta(minutes=shift.grace_period_minutes)
                if now > grace_limit:
                    status = "Late"
                    late_minutes = int((now - shift_start).total_seconds() / 60)
            else: # Checkout check
                # Check early departure
                if now < shift_end:
                    early_exit_minutes = int((shift_end - now).total_seconds() / 60)
                # Check overtime
                if now > shift_end:
                    overtime_hours = round((now - shift_end).total_seconds() / 3600, 2)

        # 6. Calculate Streak Info
        streak = 0
        if recent_log and recent_log.attendance_streak:
            streak = recent_log.attendance_streak
        else:
            # Look at yesterday's record
            yesterday = today - datetime.timedelta(days=1)
            yesterday_record = crud.get_attendance_by_employee_and_date(db, employee_id=employee.id, attendance_date=yesterday)
            if yesterday_record and yesterday_record.status in ["Present", "Late"]:
                streak = yesterday_record.attendance_streak + 1
            else:
                streak = 1

        return {
            "allowed": True,
            "status": status if not employee.allow_wfh else "WFH",
            "late_minutes": late_minutes,
            "early_exit_minutes": early_exit_minutes,
            "overtime_hours": overtime_hours,
            "streak": streak,
            "shift_info": shift_info,
            "geofence_result": geofence_result,
            "policy_version": "v2.0-Enterprise"
        }
