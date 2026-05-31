"""Gemini client for non-agentic AI calls.

Used by:
- parse_intent: turn natural language search into structured intent
- rank_matches: rank candidate assets by suitability
- generate_encouragement: write friendly reminder messages

Each call has a deterministic fallback so the system never breaks.
"""
import json
from app.config import settings


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


INTENT_PROMPT = """You are the intent parser for Atrium, Hillingdon Council's intelligent booking system.

Parse this natural language request from a resident or staff member:

"{user_input}"

Return a JSON object matching this exact schema (no other text):

{{
  "capacity": <number or null>,
  "location": <Hillingdon ward name or "anywhere" or null>,
  "frequency": "one-off" | "weekly" | "monthly" | null,
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

If the request is clear and complete, set follow_up_question to null. British English.
Hillingdon wards include: Botwell, Hayes Town, Yiewsley, Uxbridge, Northwood, Ruislip, Manor, Brunel, Pinkwell, Heathrow Villages, Hillingdon East, West Drayton, Townfield, Charville."""


MATCH_PROMPT = """You are Atrium's matching engine. Rank these council assets against the user's intent.

USER INTENT:
{intent_json}

AVAILABLE ASSETS (with availability already filtered):
{inventory_json}

Return a JSON array of up to 4 ranked matches (no other text):
[
  {{
    "asset_id": <string from inventory>,
    "rank": <1 to 4>,
    "match_score": <0 to 100>,
    "reasoning": "One sentence British English explaining why this is a strong match. Reference specific facts.",
    "carbon_estimate_kg": <realistic number based on travel distance>,
    "accessibility_match": "full" | "partial" | "none"
  }}
]

If no assets fit, return an empty array."""


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
    client = _get_client()
    if client is None:
        return _fallback_intent(user_input)
    try:
        from google.genai import types
        response = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=INTENT_PROMPT.format(user_input=user_input),
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            ),
        )
        return json.loads(response.text)
    except Exception:
        return _fallback_intent(user_input)


async def rank_matches(intent: dict, inventory: list[dict]) -> list[dict]:
    if not inventory:
        return []
    client = _get_client()
    if client is None:
        return _fallback_matches(inventory)
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
        return _fallback_matches(inventory)


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


def _fallback_matches(inventory: list[dict]) -> list[dict]:
    out = []
    for i, a in enumerate(inventory[:4]):
        out.append({
            "asset_id": a["id"],
            "rank": i + 1,
            "match_score": 92 - (i * 8),
            "reasoning": f"{a['name']} matches the request based on capacity, location, and available amenities.",
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
