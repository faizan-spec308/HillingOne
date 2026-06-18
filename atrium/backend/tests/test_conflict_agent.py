"""Cycle 3: the autonomous Conflict Resolution Agent (deterministic engine)."""
from app.agents.conflict_agent import ConflictResolutionAgent
from app.models.reminder import Reminder
from sqlalchemy import select


async def test_agent_proposes_swap_to_same_ward_alternative(db, make, monkeypatch):
    user = await make.user(db)
    original = await make.asset(db, name="Hayes End", ward="Hayes Town", capacity=60, kitchen=True, wheelchair=True)
    alt = await make.asset(db, name="Charville Hall", ward="Hayes Town", capacity=45, kitchen=False, wheelchair=True)
    booking = await make.booking(db, original, user, state="confirmed", attendees=10)

    agent = ConflictResolutionAgent(db)
    monkeypatch.setattr(agent, "_get_client", lambda: None)  # force deterministic path
    result = await agent.resolve(str(booking.id), "Councillor needs this hall at the same time.")

    assert result["final_decision"] == "swap_proposed"
    await db.refresh(booking)
    assert booking.state == "swap_pending"
    assert str(booking.alternative_offered_id) == str(alt.id)
    assert booking.goodwill_credit_applied == 20

    notes = (await db.execute(select(Reminder).where(Reminder.user_id == user.id))).scalars().all()
    assert len(notes) >= 1, "resident should be notified of the proposed swap"


async def test_agent_escalates_when_no_alternative(db, make, monkeypatch):
    user = await make.user(db)
    only = await make.asset(db, name="Manor Pod", ward="Manor", capacity=8)
    booking = await make.booking(db, only, user, state="confirmed", attendees=5)

    agent = ConflictResolutionAgent(db)
    monkeypatch.setattr(agent, "_get_client", lambda: None)
    result = await agent.resolve(str(booking.id), "Need this room.")

    assert result["final_decision"] == "escalated"
    await db.refresh(booking)
    assert booking.state == "confirmed", "escalation must never cancel or move the booking"


async def test_agent_widens_search_dropping_amenities(db, make, monkeypatch):
    """The only alternative lacks the kitchen the original has — the agent should
    still propose it (amenities are scoring factors, not hard filters)."""
    user = await make.user(db)
    original = await make.asset(db, name="Hayes End", ward="Hayes Town", kitchen=True)
    alt = await make.asset(db, name="No-Kitchen Hall", ward="Hayes Town", capacity=50, kitchen=False)
    booking = await make.booking(db, original, user, state="confirmed", attendees=10)

    agent = ConflictResolutionAgent(db)
    monkeypatch.setattr(agent, "_get_client", lambda: None)
    result = await agent.resolve(str(booking.id), "Priority need.")

    assert result["final_decision"] == "swap_proposed"
    await db.refresh(booking)
    assert str(booking.alternative_offered_id) == str(alt.id)
