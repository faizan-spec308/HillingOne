"""Seed data: real Hillingdon assets, plausible users, realistic bookings.

Run via: python -m app.seed.seed_data
Skips silently if assets already exist.
"""
import asyncio
import uuid
import random
from datetime import datetime, timedelta, timezone
from sqlalchemy import select

import bcrypt as _bcrypt

from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.asset import Asset
from app.models.booking import Booking


def _hash(pw: str) -> str:
    return _bcrypt.hashpw(pw.encode()[:72], _bcrypt.gensalt()).decode()


# ── Users ────────────────────────────────────────────────────────────────────
# (email, name, role, ward, password)
USERS_DATA = [
    ("aisha.khan@example.com",        "Aisha Khan",       "resident",   "Hayes Town",    "Resident2026!"),
    ("david.thompson@example.com",    "David Thompson",   "resident",   "Yiewsley",      "Resident2026!"),
    ("priya.shah@example.com",        "Priya Shah",       "resident",   "Uxbridge",      "Resident2026!"),
    ("michael.obrien@example.com",    "Michael O'Brien",  "resident",   "Ruislip",       "Resident2026!"),
    ("sarah.patel@hillingdon.gov.uk", "Sarah Patel",      "staff",      None,            "Staff2026!"),
    ("cllr.smith@hillingdon.gov.uk",  "Cllr Jane Smith",  "councillor", None,            "Staff2026!"),
]


# ── Assets ───────────────────────────────────────────────────────────────────
# (name, category, ward, capacity, hourly_rate, wheelchair, parking, kitchen, lat, lng)
ASSETS_DATA = [
    # ── Community centres ─────────────────────────────────────────────────
    ("Botwell Green Community Centre",      "community_centres", "Botwell",         80,  35.00, True,  True,  True,  51.5083, -0.4189),
    ("Hayes End Community Centre",          "community_centres", "Hayes Town",       60,  28.00, True,  False, True,  51.5147, -0.4275),
    ("Yiewsley Community Centre",           "community_centres", "Yiewsley",         50,  22.00, True,  False, True,  51.5119, -0.4708),
    ("Northwood Community Centre",          "community_centres", "Northwood",        70,  32.00, True,  True,  False, 51.6116, -0.4242),
    ("Ickenham Village Hall",               "community_centres", "Ickenham",         80,  35.00, True,  True,  True,  51.5615, -0.4490),
    ("West Drayton Community Centre",       "community_centres", "Yiewsley",         65,  28.00, True,  True,  True,  51.5022, -0.4703),
    ("Harlington Community Centre",         "community_centres", "Harlington",       55,  24.00, True,  True,  False, 51.4895, -0.4251),
    ("Charville Community Hall",            "community_centres", "Hayes Town",       45,  20.00, True,  False, False, 51.5156, -0.4302),
    ("South Ruislip Community Centre",      "community_centres", "South Ruislip",    70,  30.00, True,  True,  True,  51.5540, -0.4066),
    ("Yeading Community Centre",            "community_centres", "Yeading",          50,  22.00, False, True,  True,  51.5289, -0.3908),

    # ── Library spaces ─────────────────────────────────────────────────────
    ("Uxbridge Library Meeting Room",       "library_spaces",    "Uxbridge",         20,  15.00, True,  False, False, 51.5429, -0.4781),
    ("Manor Farm Library Study Pod",        "library_spaces",    "Manor",             8,   8.00, True,  False, False, 51.5721, -0.4189),
    ("Northwood Library Hall",              "library_spaces",    "Northwood",        35,  18.00, True,  False, False, 51.6113, -0.4233),
    ("Ruislip Manor Library Group Room",    "library_spaces",    "Ruislip",          15,  12.00, True,  True,  False, 51.5746, -0.4150),
    ("Hayes Library Conference Room",       "library_spaces",    "Hayes Town",       18,  12.00, True,  False, False, 51.5139, -0.4268),
    ("West Drayton Library Meeting Room",   "library_spaces",    "Yiewsley",         12,  10.00, True,  True,  False, 51.5025, -0.4699),
    ("Ruislip Library Meeting Room",        "library_spaces",    "Ruislip",          20,  15.00, True,  True,  False, 51.5759, -0.4170),
    ("Eastcote Library Group Room",         "library_spaces",    "Eastcote",         14,  10.00, True,  True,  False, 51.5842, -0.3975),
    ("Ickenham Library Meeting Room",       "library_spaces",    "Ickenham",         16,  12.00, True,  False, False, 51.5618, -0.4498),

    # ── Children's centres ─────────────────────────────────────────────────
    ("Hayes Children's Centre Activity Room A",       "childrens_centres", "Hayes Town",      25,  12.00, True,  True,  True,  51.5142, -0.4263),
    ("Hayes Children's Centre Activity Room B",       "childrens_centres", "Hayes Town",      25,  12.00, True,  True,  True,  51.5142, -0.4263),
    ("Yiewsley Children's Centre Family Room",        "childrens_centres", "Yiewsley",        20,  10.00, True,  True,  True,  51.5125, -0.4710),
    ("Northwood Children's Centre Sensory Room",      "childrens_centres", "Northwood",       12,  10.00, True,  False, False, 51.6118, -0.4240),
    ("Pinkwell Children's Centre Activity Room",      "childrens_centres", "Hayes Town",      22,  12.00, True,  True,  True,  51.5040, -0.4195),
    ("Charville Children's Centre Group Room",        "childrens_centres", "Hayes Town",      18,  10.00, True,  False, False, 51.5156, -0.4302),
    ("Colham Children's Centre Activity Space",       "childrens_centres", "Hillingdon East", 20,  12.00, True,  True,  False, 51.5410, -0.4520),

    # ── Sports & leisure ───────────────────────────────────────────────────
    ("Botwell Green Sports Centre Hall",            "sports_leisure", "Botwell",         120,  55.00, True,  True,  False, 51.5085, -0.4193),
    ("Highgrove Pool Function Room",                "sports_leisure", "Ruislip",          60,  35.00, True,  True,  True,  51.5752, -0.4145),
    ("Hillingdon Sports Complex Meeting Room",      "sports_leisure", "Hillingdon East",  30,  20.00, True,  False, False, 51.5448, -0.4485),
    ("Queensmead Sports Centre Activity Hall",      "sports_leisure", "South Ruislip",   100,  55.00, True,  True,  False, 51.5552, -0.4058),
    ("Uxbridge Sports Ground Pavilion",             "sports_leisure", "Uxbridge",         40,  25.00, True,  True,  True,  51.5482, -0.4740),

    # ── Council buildings ──────────────────────────────────────────────────
    ("Civic Centre Committee Room A",        "council_buildings", "Uxbridge",   30,  22.00, True,  True,  False, 51.5466, -0.4790),
    ("Civic Centre Committee Room B",        "council_buildings", "Uxbridge",   25,  20.00, True,  True,  False, 51.5466, -0.4790),
    ("Civic Centre Public Meeting Hall",     "council_buildings", "Uxbridge",  200,  80.00, True,  True,  True,  51.5466, -0.4790),

    # ── Outdoor spaces ─────────────────────────────────────────────────────
    ("Yiewsley Recreation Ground Pavilion",  "outdoor_spaces", "Yiewsley",         40,  18.00, False, True,  False, 51.5132, -0.4720),
    ("Hillingdon Court Park Pavilion",       "outdoor_spaces", "Hillingdon East",  50,  22.00, True,  True,  False, 51.5398, -0.4388),
    ("Manor Farm Outdoor Terrace",           "outdoor_spaces", "Manor",            60,  25.00, True,  True,  False, 51.5725, -0.4187),
    ("Ruislip Lido Events Pavilion",         "outdoor_spaces", "Ruislip",         100,  40.00, True,  True,  True,  51.5813, -0.4348),
    ("Fassnidge Park Pavilion",              "outdoor_spaces", "Uxbridge",         55,  25.00, True,  True,  False, 51.5430, -0.4778),
    ("Lake Farm Country Park Events Space",  "outdoor_spaces", "Hayes Town",       75,  28.00, False, True,  False, 51.5072, -0.4392),
    ("Hillingdon House Farm Events Barn",    "outdoor_spaces", "Hillingdon East", 120,  45.00, False, True,  True,  51.5400, -0.4470),
    ("Cranford Countryside Park Pavilion",   "outdoor_spaces", "Hillingdon East",  40,  18.00, False, True,  False, 51.4890, -0.4310),

    # ── Equipment ──────────────────────────────────────────────────────────
    ("Audio Visual Loan Kit",          "equipment", "Uxbridge", 1,   8.00, True, False, False, 51.5466, -0.4790),
    ("Portable PA System",             "equipment", "Uxbridge", 1,   6.00, True, False, False, 51.5466, -0.4790),
    ("Marquee for Community Events",   "equipment", "Uxbridge", 1,  25.00, True, False, False, 51.5466, -0.4790),
    ("Projector and Screen Bundle",    "equipment", "Uxbridge", 1,   5.00, True, False, False, 51.5466, -0.4790),
    ("Laptop Bundle (x10)",            "equipment", "Uxbridge", 1,  15.00, True, False, False, 51.5466, -0.4790),
    ("Folding Table & Chair Set x50",  "equipment", "Uxbridge", 1,  12.00, True, False, False, 51.5466, -0.4790),
]


def _build_amenities(kitchen: bool, parking: bool) -> dict:
    return {
        "kitchen":    kitchen,
        "wifi":       True,
        "projector":  True,
        "whiteboard": True,
        "stage":      False,
        "parking":    parking,
    }


def _build_accessibility(wheelchair: bool) -> dict:
    return {
        "wheelchair_access":   wheelchair,
        "hearing_loop":        wheelchair,
        "accessible_toilet":   wheelchair,
        "parking_accessible":  wheelchair,
    }


def _generate_reference() -> str:
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    suffix = str(uuid.uuid4())[:6].upper()
    return f"ATR-{today}-{suffix}"


async def seed():
    async with AsyncSessionLocal() as db:
        existing = (await db.execute(select(Asset))).scalars().first()
        if existing:
            print("[seed] Assets already exist — skipping.")
            return

        # ── Users ────────────────────────────────────────────────────────
        users = []
        for email, name, role, ward, password in USERS_DATA:
            u = User(
                id=uuid.uuid4(),
                email=email,
                name=name,
                role=role,
                ward=ward,
                flexibility_credits=0,
                password_hash=_hash(password),
            )
            db.add(u)
            users.append(u)

        # ── Assets ───────────────────────────────────────────────────────
        assets = []
        for (name, category, ward, capacity, hourly_rate,
             wheelchair, parking, kitchen, lat, lng) in ASSETS_DATA:
            a = Asset(
                id=uuid.uuid4(),
                name=name,
                category=category,
                ward=ward,
                capacity=capacity,
                description=f"{name} in {ward}, London Borough of Hillingdon. Capacity {capacity}.",
                accessibility=_build_accessibility(wheelchair),
                amenities=_build_amenities(kitchen, parking),
                hourly_rate=hourly_rate,
                latitude=lat,
                longitude=lng,
                image_url=(
                    f"https://placehold.co/400x300/0D9488/FFFFFF/png"
                    f"?text={name.replace(' ', '+')}"
                ),
                co2_per_visit=round(0.3 + random.random() * 0.7, 2),
                is_active=True,
            )
            db.add(a)
            assets.append(a)

        await db.commit()
        for u in users:
            await db.refresh(u)
        for a in assets:
            await db.refresh(a)

        # ── Sample bookings ───────────────────────────────────────────────
        residents = [u for u in users if u.role == "resident"]
        staff     = [u for u in users if u.role in ("staff", "councillor")]
        all_actors = residents + staff

        purpose_pool = [
            "Community after-school club",
            "Weekly book group",
            "Local councillor surgery",
            "Sports training session",
            "Mother and baby group",
            "Community choir rehearsal",
            "Local business networking",
            "Adult learning course",
            "Charity fundraising meeting",
            "Resident association meeting",
        ]

        now = datetime.now(timezone.utc)
        bookings_created = 0
        attempts = 0

        while bookings_created < 60 and attempts < 200:
            attempts += 1
            asset = random.choice(assets)
            user  = random.choice(all_actors)
            day   = random.randint(0, 14)
            hour  = random.choice([9, 10, 11, 13, 14, 15, 16, 17, 18, 19])
            start = (now + timedelta(days=day)).replace(
                hour=hour, minute=0, second=0, microsecond=0
            )
            end   = start + timedelta(hours=random.choice([1, 2, 2, 3]))

            conflict = (await db.execute(
                select(Booking).where(
                    Booking.asset_id == asset.id,
                    Booking.state.in_(["confirmed", "held"]),
                    Booking.start_time < end,
                    Booking.end_time > start,
                )
            )).scalars().first()
            if conflict:
                continue

            state = random.choices(
                ["confirmed", "confirmed", "confirmed", "held", "completed"],
                weights=[5, 5, 5, 1, 2],
            )[0]

            db.add(Booking(
                id=uuid.uuid4(),
                asset_id=asset.id,
                user_id=user.id,
                state=state,
                start_time=start,
                end_time=end,
                purpose=random.choice(purpose_pool),
                attendee_count=random.randint(1, min(asset.capacity, 50)),
                confirmed_at=now if state in ("confirmed", "completed") else None,
                held_until=now + timedelta(seconds=60) if state == "held" else None,
                reference=_generate_reference(),
            ))
            bookings_created += 1

        await db.commit()
        print(
            f"[seed] {len(users)} users, {len(assets)} assets, "
            f"{bookings_created} bookings created."
        )
        print("[seed] Resident password: Resident2026!")
        print("[seed] Staff password:    Staff2026!")


if __name__ == "__main__":
    asyncio.run(seed())
