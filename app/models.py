import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean,
    Numeric, Date, Time, DateTime, ForeignKey,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship
from app.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    icon = Column(String(10))

    facilities = relationship("Facility", back_populates="category")


class Facility(Base):
    __tablename__ = "facilities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"))
    location = Column(String(100))
    address = Column(String(200))
    capacity = Column(Integer)
    hourly_rate = Column(Numeric(8, 2))
    description = Column(Text)
    amenities = Column(ARRAY(String))
    accessibility = Column(Boolean, default=False)
    parking = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    category = relationship("Category", back_populates="facilities")
    time_slots = relationship("TimeSlot", back_populates="facility")
    bookings = relationship("Booking", back_populates="facility")


class TimeSlot(Base):
    __tablename__ = "time_slots"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("facilities.id"))
    slot_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    is_available = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    facility = relationship("Facility", back_populates="time_slots")
    bookings = relationship("Booking", back_populates="time_slot")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    email = Column(String(200))
    phone = Column(String(20))
    role = Column(String(20), default="resident")  # resident, staff, admin
    department = Column(String(100))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    bookings = relationship("Booking", back_populates="user")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    reference = Column(String(20), unique=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))
    facility_id = Column(Integer, ForeignKey("facilities.id"))
    time_slot_id = Column(Integer, ForeignKey("time_slots.id"))
    status = Column(String(20), default="confirmed")  # confirmed, pending, cancelled
    notes = Column(Text)
    ai_suggested = Column(Boolean, default=False)
    ai_confidence = Column(Numeric(5, 2))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="bookings")
    facility = relationship("Facility", back_populates="bookings")
    time_slot = relationship("TimeSlot", back_populates="bookings")
