import random


def generate_unique_reference(db) -> str:
    from app.models import Booking

    while True:
        ref = f"HBC-2026-{random.randint(1000, 9999):04d}"
        if not db.query(Booking).filter(Booking.reference == ref).first():
            return ref
