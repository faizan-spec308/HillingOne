import datetime
import json
from google import genai
from google.genai import types
from sqlalchemy.orm import Session
from app.models import Booking, Category, Facility, TimeSlot
from app.config import settings
from app.utils.helpers import generate_unique_reference

# ── In-memory facility cache (populated on startup) ───────────────────────────
_facilities_cache: list = []


def load_facilities_cache(db: Session) -> None:
    global _facilities_cache
    facilities = (
        db.query(Facility)
        .join(Category)
        .filter(Facility.is_active == True)
        .all()
    )
    _facilities_cache = [
        {
            "id": f.id,
            "name": f.name,
            "category": f.category.name,
            "location": f.location,
            "capacity": f.capacity,
            "hourly_rate": float(f.hourly_rate) if f.hourly_rate else None,
            "amenities": f.amenities or [],
            "parking": f.parking,
            "accessibility": f.accessibility,
            "description": f.description,
        }
        for f in facilities
    ]


def _client() -> genai.Client:
    return genai.Client(api_key=settings.gemini_api_key)


def _json_config() -> types.GenerateContentConfig:
    return types.GenerateContentConfig(response_mime_type="application/json")


def _search_prompt(query: str) -> str:
    today = datetime.date.today().isoformat()
    facilities_json = json.dumps(_facilities_cache, ensure_ascii=False)
    return f"""You are a booking assistant for Hillingdon Council (London Borough).
Match the resident's request to the best available facilities.

TODAY: {today}

FACILITIES DATABASE:
{facilities_json}

RESIDENT REQUEST: "{query}"

Reply ONLY with valid JSON — no markdown, no explanation — matching this exact schema:
{{
  "needs_clarification": false,
  "suggestions": [
    {{
      "facility_id": <integer>,
      "confidence": <float 0-100>,
      "reason": "<one sentence why this facility matches>"
    }}
  ],
  "clarification_options": [],
  "ai_message": "<warm, helpful reply to the resident>"
}}

RULES:
1. Return 1–3 suggestions ordered by confidence (highest first).
2. Only include facilities with confidence >= 40.
3. If the request is too vague to identify a facility type, set needs_clarification=true
   and populate clarification_options with 4 short choices (do NOT populate suggestions).
4. Match on: facility type/category, location preference, capacity needs, amenities, accessibility.
5. Detect the resident's language; write ai_message in the same language.
6. Confidence guide: 90+ excellent, 75-89 good, 55-74 possible, <55 weak."""


def _book_prompt(query: str) -> str:
    today = datetime.date.today().isoformat()
    facilities_json = json.dumps(_facilities_cache, ensure_ascii=False)
    return f"""You are a booking assistant for Hillingdon Council.
Parse the resident's booking request and extract booking details.

TODAY: {today}

FACILITIES DATABASE:
{facilities_json}

RESIDENT REQUEST: "{query}"

Reply ONLY with valid JSON:
{{
  "facility_id": <integer matching the best facility, or null if unclear>,
  "confidence": <float 0-100>,
  "date_preference": "<ISO date YYYY-MM-DD calculated from today if relative, or null>",
  "time_preference": "<morning|afternoon|evening|null>",
  "purpose": "<brief purpose extracted from request>",
  "message": "<friendly reply confirming what you understood>"
}}

RULES:
- Identify the specific facility by name/type from the database.
- Resolve relative dates (next Saturday, tomorrow) to actual ISO dates from today ({today}).
- morning = before 12:00, afternoon = 12:00-17:00, evening = after 17:00.
- Return ONLY pure JSON."""


def search_facilities(query: str, db: Session) -> dict:
    if not _facilities_cache:
        load_facilities_cache(db)

    try:
        client = _client()
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=_search_prompt(query),
            config=_json_config(),
        )
        result = json.loads(response.text)
    except Exception:
        return {
            "suggestions": [],
            "ai_message": (
                "I'm having trouble processing your request right now. "
                "Please try again or call 01895 250111."
            ),
            "needs_clarification": True,
            "clarification_options": [
                "Book a room or hall for an event",
                "Book a sports facility",
                "Book a council appointment or service",
                "Hire equipment",
            ],
        }

    suggestions = []
    for s in result.get("suggestions", []):
        fid = s.get("facility_id")
        if not fid:
            continue
        facility = db.query(Facility).join(Category).filter(Facility.id == fid).first()
        if not facility:
            continue

        upcoming_slots = (
            db.query(TimeSlot)
            .filter(
                TimeSlot.facility_id == fid,
                TimeSlot.is_available == True,
                TimeSlot.slot_date >= datetime.date.today(),
            )
            .order_by(TimeSlot.slot_date, TimeSlot.start_time)
            .limit(5)
            .all()
        )

        suggestions.append(
            {
                "facility_id": facility.id,
                "name": facility.name,
                "category": facility.category.name if facility.category else "",
                "location": facility.location,
                "address": facility.address,
                "capacity": facility.capacity,
                "hourly_rate": float(facility.hourly_rate) if facility.hourly_rate else None,
                "amenities": facility.amenities or [],
                "parking": facility.parking,
                "accessibility": facility.accessibility,
                "confidence": round(float(s.get("confidence", 0)), 1),
                "reason": s.get("reason", ""),
                "available_slots": [
                    {
                        "slot_id": slot.id,
                        "date": slot.slot_date.isoformat(),
                        "start_time": slot.start_time.strftime("%H:%M"),
                        "end_time": slot.end_time.strftime("%H:%M"),
                    }
                    for slot in upcoming_slots
                ],
            }
        )

    return {
        "suggestions": suggestions,
        "ai_message": result.get("ai_message", ""),
        "needs_clarification": result.get("needs_clarification", False),
        "clarification_options": result.get("clarification_options", []),
    }


def book_facility(query: str, user_id: int, db: Session) -> dict:
    if not _facilities_cache:
        load_facilities_cache(db)

    try:
        client = _client()
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=_book_prompt(query),
            config=_json_config(),
        )
        result = json.loads(response.text)
    except Exception:
        return {
            "success": False,
            "booking": None,
            "ai_message": "I couldn't process your booking request. Please try again.",
        }

    fid = result.get("facility_id")
    if not fid:
        return {
            "success": False,
            "booking": None,
            "ai_message": (
                f"{result.get('message', '')} "
                "Please search for the facility first so I can book the right one."
            ),
        }

    facility = db.query(Facility).filter(Facility.id == fid, Facility.is_active == True).first()
    if not facility:
        return {"success": False, "booking": None, "ai_message": "Facility not found in the database."}

    slot_q = db.query(TimeSlot).filter(
        TimeSlot.facility_id == fid,
        TimeSlot.is_available == True,
        TimeSlot.slot_date >= datetime.date.today(),
    )

    date_pref = result.get("date_preference")
    if date_pref:
        try:
            slot_q = slot_q.filter(TimeSlot.slot_date == datetime.date.fromisoformat(date_pref))
        except ValueError:
            pass

    time_pref = result.get("time_preference")
    if time_pref == "morning":
        slot_q = slot_q.filter(TimeSlot.start_time < datetime.time(12, 0))
    elif time_pref == "afternoon":
        slot_q = slot_q.filter(
            TimeSlot.start_time >= datetime.time(12, 0),
            TimeSlot.start_time < datetime.time(17, 0),
        )
    elif time_pref == "evening":
        slot_q = slot_q.filter(TimeSlot.start_time >= datetime.time(17, 0))

    slot = slot_q.order_by(TimeSlot.slot_date, TimeSlot.start_time).first()
    if not slot:
        return {
            "success": False,
            "booking": None,
            "ai_message": (
                f"I found {facility.name} but there are no available slots matching your request. "
                "Would you like to search for available dates?"
            ),
        }

    reference = generate_unique_reference(db)
    booking = Booking(
        reference=reference,
        user_id=user_id,
        facility_id=fid,
        time_slot_id=slot.id,
        status="confirmed",
        notes=result.get("purpose", "Booked via AI assistant"),
        ai_suggested=True,
        ai_confidence=result.get("confidence", 0),
        created_at=datetime.datetime.utcnow(),
    )
    db.add(booking)
    slot.is_available = False
    db.commit()
    db.refresh(booking)

    amenities_preview = ", ".join((facility.amenities or [])[:3]) or "standard facilities"
    date_fmt = slot.slot_date.strftime("%A %d %B %Y")
    parking_note = " Parking is available on-site." if facility.parking else ""

    return {
        "success": True,
        "booking": {
            "reference": reference,
            "facility": facility.name,
            "location": facility.location,
            "address": facility.address,
            "date": slot.slot_date.isoformat(),
            "start_time": slot.start_time.strftime("%H:%M"),
            "end_time": slot.end_time.strftime("%H:%M"),
            "status": "confirmed",
            "ai_confidence": float(result.get("confidence", 0)),
            "amenities": facility.amenities or [],
        },
        "ai_message": (
            f"All booked! {facility.name} is confirmed for {date_fmt}, "
            f"{slot.start_time.strftime('%H:%M')}-{slot.end_time.strftime('%H:%M')}. "
            f"Your reference is {reference}. "
            f"The venue includes {amenities_preview}.{parking_note}"
        ),
    }
