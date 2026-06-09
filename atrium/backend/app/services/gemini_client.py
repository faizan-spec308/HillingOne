"""Gemini client for non-agentic AI calls.

Used by:
- parse_intent: turn natural language search into structured intent
- rank_matches: rank candidate assets by suitability
- generate_encouragement: write friendly reminder messages

Each call has a deterministic fallback so the system never breaks.
"""
import json
import time
from datetime import date
from app.config import settings

# Cache intent parsing results — same query text always maps to same intent.
# Saves one Gemini call per repeated search. TTL: 10 minutes.
_intent_cache: dict[str, tuple[float, dict]] = {}
_INTENT_TTL = 600


_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    if not settings.gemini_api_key or settings.gemini_api_key.startswith("paste_"):
        return None
    try:
        from google import genai
        _client = genai.Client(api_key=settings.gemini_api_key)
        return _client
    except ImportError:
        return None


INTENT_PROMPT = """You are the intent parser for HillingOne, Hillingdon Council's intelligent booking system.

Parse this natural language request from a resident or staff member:

"{user_input}"

Return a JSON object matching this exact schema (no other text):

{{
  "capacity": <number or null>,
  "location": <Hillingdon ward name or "anywhere" or null>,
  "venue_type": "office" | "meeting_room" | "hall" | "sports" | "outdoor" | "community" | "studio" | "other" | null,
  "frequency": "one-off" | "weekly" | "monthly" | null,
  "specific_date": <ISO date string "YYYY-MM-DD" if a specific date was mentioned, else null>,
  "day_of_week": <string or null>,
  "time_of_day": "morning" | "afternoon" | "evening" | null,
  "duration_hours": <number or null>,
  "accessibility_required": {{
    "wheelchair_access": <true/false/null>,
    "hearing_loop": <true/false/null>
  }},
  "kitchen_required": <true/false/null>,
  "equipment_needed": [<strings>],
  "audience_type": <string or null>,
  "purpose_summary": <short string>,
  "missing_info": [<field names that should be clarified>],
  "follow_up_question": <one specific natural-language question, or null if everything is clear>,
  "extracted_summary": "We understood: ..." (human-readable two to three line summary)
}}

venue_type guidance:
- "office" or "office space" → "office"
- "meeting room", "boardroom", "conference" → "meeting_room"
- "hall", "community hall", "function room" → "hall"
- "sports hall", "gym", "pitch", "court" → "sports"
- "park", "garden", "outdoor" → "outdoor"
- "studio", "recording", "dance" → "studio"
- generic "community centre" → "community"

specific_date rules: Today is {today}. If the user says "10th of June", "next Friday", "this Saturday", "tomorrow" etc., resolve it to an absolute YYYY-MM-DD date and put it in specific_date. If no date is mentioned, set specific_date to null.

If the request is clear and complete, set follow_up_question to null. British English.
Hillingdon wards include: Botwell, Hayes Town, Yiewsley, Uxbridge, Northwood, Ruislip, Manor, Brunel, Pinkwell, Heathrow Villages, Hillingdon East, West Drayton, Townfield, Charville."""


MATCH_PROMPT = """You are HillingOne's matching engine. Rank council assets against the user's intent using STRICT scoring rules.

USER INTENT:
{intent_json}

AVAILABLE ASSETS (availability already pre-filtered, capacity already pre-filtered — all assets in this list are valid candidates):
{inventory_json}

SCORING RULES (apply in order):

1. VENUE TYPE (±25 points):
   - If intent.venue_type is set: assets whose category closely matches get +25. Assets that are clearly a different type get -25.
   - Fuzzy matches (e.g. user wants "office", asset is "meeting_room") get +10.
   - If intent.venue_type is null: ignore venue type scoring.

2. AMENITIES (up to +15 points):
   - +8 if kitchen_required matches
   - +4 if accessibility_required matches
   - +3 per relevant equipment match

3. SCORE FLOOR: If the asset fails the venue type check and no amenities match, cap at 40/100.

NOTE: Location has already been pre-filtered by the backend. All assets in the inventory are
either in the requested ward, or location was not specified. Do NOT penalise for location.

Return a JSON array of up to 4 matches, best first (no other text):
[
  {{
    "asset_id": <string from inventory>,
    "rank": <1 to 4>,
    "match_score": <0 to 100, applying the rules above>,
    "reasoning": "One sentence British English citing the specific match factors.",
    "carbon_estimate_kg": <realistic small number, e.g. 0.3 to 1.2>,
    "accessibility_match": "full" | "partial" | "none"
  }}
]

If fewer than 4 assets fit acceptably, return only those that do. If none fit, return [].
Never fabricate asset_ids — only use IDs from the inventory above."""


ENCOURAGEMENT_PROMPT = """You are writing a short, warm reminder for a council booking.

User name: {user_name}
Asset: {asset_name} ({ward})
Time: {start_time}
Purpose: {purpose}

Write ONE short encouraging reminder message in British English. Maximum 40 words.
Tone: warm, genuine, not over-cheerful. Encourage them to attend, mention the venue,
and offer to help if anything has changed. No exclamation marks.
Return ONLY the message text, nothing else."""


async def parse_intent(user_input: str) -> dict:
    # Include today's date in cache key — same query on a different day resolves differently
    cache_key = f"{date.today().isoformat()}:{user_input.strip().lower()}"
    now = time.monotonic()
    if cache_key in _intent_cache and now - _intent_cache[cache_key][0] < _INTENT_TTL:
        return _intent_cache[cache_key][1]

    client = _get_client()
    if client is None:
        result = _fallback_intent(user_input)
        _intent_cache[cache_key] = (now, result)
        return result
    try:
        from google.genai import types
        response = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=INTENT_PROMPT.format(user_input=user_input, today=date.today().isoformat()),
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            ),
        )
        result = json.loads(response.text)
        _intent_cache[cache_key] = (now, result)
        return result
    except Exception:
        return _fallback_intent(user_input)


async def rank_matches(intent: dict, inventory: list[dict]) -> list[dict]:
    if not inventory:
        return []
    client = _get_client()
    if client is None:
        return _fallback_matches(inventory, intent)
    try:
        from google.genai import types
        response = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=MATCH_PROMPT.format(
                intent_json=json.dumps(intent),
                inventory_json=json.dumps(inventory[:20]),
            ),
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            ),
        )
        return json.loads(response.text)
    except Exception:
        return _fallback_matches(inventory, intent)


async def generate_encouragement(
    user_name: str,
    asset_name: str,
    ward: str,
    start_time: str,
    purpose: str | None,
) -> str:
    client = _get_client()
    if client is None:
        return _fallback_encouragement(asset_name, ward)
    try:
        from google.genai import types
        response = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=ENCOURAGEMENT_PROMPT.format(
                user_name=user_name,
                asset_name=asset_name,
                ward=ward,
                start_time=start_time,
                purpose=purpose or "your booking",
            ),
            config=types.GenerateContentConfig(temperature=0.7),
        )
        return response.text.strip()
    except Exception:
        return _fallback_encouragement(asset_name, ward)


def _fallback_intent(user_input: str) -> dict:
    text = user_input.lower()
    capacity = None
    for token in text.split():
        if token.isdigit():
            n = int(token)
            if 2 <= n <= 500:
                capacity = n
                break

    location = None
    wards = ["botwell", "hayes", "yiewsley", "uxbridge", "northwood", "ruislip",
             "west drayton", "ickenham", "harefield", "cowley"]
    for w in wards:
        if w in text:
            location = w.title()
            break

    return {
        "capacity": capacity,
        "location": location,
        "frequency": "weekly" if "weekly" in text or "every" in text else "one-off",
        "day_of_week": None,
        "time_of_day": "afternoon" if "afternoon" in text else ("morning" if "morning" in text else None),
        "duration_hours": 2.0,
        "accessibility_required": {"wheelchair_access": "wheelchair" in text or "accessible" in text},
        "kitchen_required": "kitchen" in text,
        "equipment_needed": [],
        "audience_type": "children" if "child" in text or "kid" in text else None,
        "purpose_summary": user_input[:100],
        "missing_info": [k for k, v in {"capacity": capacity, "location": location}.items() if v is None],
        "follow_up_question": None,
        "extracted_summary": f"We understood you need: {user_input[:80]}",
    }


def _fallback_matches(inventory: list[dict], intent: dict | None = None) -> list[dict]:
    location = (intent.get("location") or "").lower() if intent else ""
    venue_type = (intent.get("venue_type") or "").lower() if intent else ""

    def score(a: dict) -> int:
        s = 50
        if location and location != "anywhere" and location in (a.get("ward") or "").lower():
            s += 35
        cat = (a.get("category") or "").lower()
        if venue_type and venue_type in cat:
            s += 25
        elif venue_type == "meeting_room" and "office" in cat:
            s += 10
        elif venue_type == "office" and "meeting" in cat:
            s += 10
        return s

    ranked = sorted(inventory, key=score, reverse=True)[:4]
    out = []
    for i, a in enumerate(ranked):
        out.append({
            "asset_id": a["id"],
            "rank": i + 1,
            "match_score": max(30, score(a)),
            "reasoning": f"{a['name']} is available and matches your request.",
            "carbon_estimate_kg": round(0.3 + i * 0.15, 2),
            "accessibility_match": "full" if (a.get("accessibility") or {}).get("wheelchair_access") else "partial",
        })
    return out


def _fallback_encouragement(asset_name: str, ward: str) -> str:
    return (
        f"A friendly reminder of your upcoming booking at {asset_name} in {ward}. "
        f"We hope it goes well. If anything has changed, you can update or cancel "
        f"from your account."
    )
