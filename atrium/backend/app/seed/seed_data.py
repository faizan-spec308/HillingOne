"""Seed data: real Hillingdon assets, plausible users, realistic bookings.

Run via: python -m app.seed.seed_data
"""
import asyncio
import uuid
import random
from datetime import datetime, timedelta
from sqlalchemy import select, delete

from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.asset import Asset
from app.models.booking import Booking


ASSETS_DATA = [
    # Community Centres
    ("Botwell Green Community Centre", "community_centres", "Botwell", 80, True, True, 51.5083, -0.4189),
    ("Hayes End Community Centre", "community_centres", "Hayes Town", 60, True, True, 51.5147, -0.4275),
    ("Yiewsley Community Centre", "community_centres", "Yiewsley", 50, True, True, 51.5119, -0.4708),
    ("Northwood Community Centre", "community_centres", "Northwood", 70, True, False, 51.6116, -0.4242),
    # Library Spaces
    ("Uxbridge Library Meeting Room", "library_spaces", "Uxbridge", 20, True, False, 51.5429, -0.4781),
    ("Manor Farm Library Study Pod", "library_spaces", "Manor", 8, True, False, 51.5721, -0.4189),
    ("Northwood Library Hall", "library_spaces", "Northwood", 35, True, False, 51.6113, -0.4233),
    ("Ruislip Manor Library Group Room", "library_spaces", "Ruislip", 15, True, False, 51.5746, -0.4150),
    # Children's Centres
    ("Hayes Children's Centre Activity Room A", "childrens_centres", "Hayes Town", 25, True, True, 51.5142, -0.4263),
    ("Hayes Children's Centre Activity Room B", "childrens_centres", "Hayes Town", 25, True, True, 51.5142, -0.4263),
    ("Yiewsley Children's Centre Family Room", "childrens_centres", "Yiewsley", 20, True, True, 51.5125, -0.4710),
    ("Northwood Children's Centre Sensory Room", "childrens_centres", "Northwood", 12, True, False, 51.6118, -0.4240),
    # Sports & Leisure
    ("Botwell Green Sports Centre Hall", "sports_leisure", "Botwell", 120, True, False, 51.5085, -0.4193),
    ("Highgrove Pool Function Room", "sports_leisure", "Ruislip", 60, True, True, 51.5752, -0.4145),
    ("Hillingdon Sports Complex Meeting Room", "sports_leisure", "Hillingdon East", 30, True, False, 51.5448, -0.4485),
    # Council Buildings
    ("Civic Centre Committee Room A", "council_buildings", "Uxbridge", 30, True, False, 51.5466, -0.4790),
    ("Civic Centre Committee Room B", "council_buildings", "Uxbridge", 25, True, False, 51.5466, -0.4790),
    ("Civic Centre Public Meeting Hall", "council_buildings", "Uxbridge", 200, True, True, 51.5466, -0.4790),
    # Outdoor Spaces
    ("Yiewsley Recreation Ground Pavilion", "outdoor_spaces", "Yiewsley", 40, False, False, 51.5132, -0.4720),
    ("Hillingdon Court Park Pavilion", "outdoor_spaces", "Hillingdon East", 50, True, False, 51.5398, -0.4388),
    ("Manor Farm Outdoor Terrace", "outdoor_spaces", "Manor", 60, True, False, 51.5725, -0.4187),
    # Equipment
    ("Audio Visual Loan Kit", "equipment", "Uxbridge", 1, True, False, 51.5466, -0.4790),
    ("Portable PA System", "equipment", "Uxbridge", 1, True, False, 51.5466, -0.4790),
    ("Marquee for Community Events", "equipment", "Uxbridge", 1, True, False, 51.5466, -0.4790),
    ("Projector and Screen Bundle", "equipment", "Uxbridge", 1, True, False, 51.5466, -0.4790),
]

USERS_DATA = [
    ("aisha.khan@example.com", "Aisha Khan", "resident", "Hayes Town"),
    ("david.thompson@example.com", "David Thompson", "resident", "Yiewsley"),
    ("priya.shah@example.com", "Priya Shah", "resident", "Uxbridge"),
    ("michael.obrien@example.com", "Michael O'Brien", "resident", "Ruislip"),
    ("sarah.patel@hillingdon.gov.uk", "Sarah Patel", "staff", None),
    ("cllr.smith@hillingdon.gov.uk", "Cllr Jane Smith", "councillor", None),
]


def _build_amenities(has_kitchen: bool) -> dict:
    return {
        "kitchen": has_kitchen,
        "wifi": True,
        "projector": True,
        "whiteboard": True,
        "stage": False,
    }


def _build_accessibility(wheelchair: bool) -> dict:
    return {
        "wheelchair_access": wheelchair,
        "hearing_loop": wheelchair,
        "accessible_toilet": wheelchair,
        "parking_accessible": wheelchair,
    }


def _generate_reference() -> str:
    today = datetime.utcnow().strftime("%Y%m%d")
    suffix = str(uuid.uuid4())[:6].upper()
    return f"ATR-{today}-{suffix}"


async def seed():
    async with AsyncSessionLocal() as db:
        # Skip if already seeded
        existing = (await db.execute(select(Asset))).scalars().first()
        if existing:
            print("[seed] Already seeded, skipping.")
            return

        # Users
        users = []
        for email, name, role, ward in USERS_DATA:
            u = User(
                id=uuid.uuid4(),
                email=email,
                name=name,
                role=role,
                ward=ward,
                flexibility_credits=0,
            )
            db.add(u)
            users.append(u)

        # Assets
        assets = []
        for name, category, ward, capacity, wheelchair, kitchen, lat, lng in ASSETS_DATA:
            a = Asset(
                id=uuid.uuid4(),
                name=name,
                category=category,
                ward=ward,
                capacity=capacity,
                description=f"{name} in {ward}, Hillingdon. Capacity {capacity}.",
                accessibility=_build_accessibility(wheelchair),
                amenities=_build_amenities(kitchen),
                hourly_rate=0,
                latitude=lat,
                longitude=lng,
                image_url=f"https://placehold.co/400x300/1B4F8C/FFFFFF/png?text={name.replace(' ', '+')}",
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

        residents = [u for u in users if u.role == "resident"]
        staff = [u for u in users if u.role == "staff"]
        all_actors = residents + staff

        # 60 bookings spread over the next 14 days, mix of states
        now = datetime.utcnow()
        bookings_created = 0
        attempts = 0
        max_attempts = 200

        while bookings_created < 60 and attempts < max_attempts:
            attempts += 1
            asset = random.choice(assets)
            user = random.choice(all_actors)
            day_offset = random.randint(0, 14)
            hour = random.choice([9, 10, 11, 13, 14, 15, 16, 17, 18, 19])
            start = (now + timedelta(days=day_offset)).replace(hour=hour, minute=0, second=0, microsecond=0)
            duration = random.choice([1, 2, 2, 3])
            end = start + timedelta(hours=duration)

            # Conflict check
            conflict_stmt = select(Booking).where(
                Booking.asset_id == asset.id,
                Booking.state.in_(["confirmed", "held"]),
                Booking.start_time < end,
                Booking.end_time > start,
            )
            existing_b = (await db.execute(conflict_stmt)).scalars().first()
            if existing_b:
                continue

            state_choice = random.choices(
                ["confirmed", "confirmed", "confirmed", "held", "completed"],
                weights=[5, 5, 5, 1, 2],
            )[0]
            attendees = random.randint(1, max(1, min(asset.capacity, 50)))
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

            booking = Booking(
                id=uuid.uuid4(),
                asset_id=asset.id,
                user_id=user.id,
                state=state_choice,
                start_time=start,
                end_time=end,
                purpose=random.choice(purpose_pool),
                attendee_count=attendees,
                confirmed_at=now if state_choice in ("confirmed", "completed") else None,
                held_until=now + timedelta(seconds=60) if state_choice == "held" else None,
                reference=_generate_reference(),
            )
            db.add(booking)
            bookings_created += 1

        await db.commit()

        print(f"[seed] Created {len(users)} users, {len(assets)} assets, {bookings_created} bookings.")


if __name__ == "__main__":
    asyncio.run(seed())
