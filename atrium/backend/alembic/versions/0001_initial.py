"""Initial Atrium schema

Revision ID: 0001_initial
Revises: 
Create Date: 2026-04-29 10:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("ward", sa.String(100), nullable=True),
        sa.Column("flexibility_credits", sa.Integer, default=0),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("ward", sa.String(100), nullable=False),
        sa.Column("capacity", sa.Integer, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("accessibility", postgresql.JSONB, nullable=True),
        sa.Column("amenities", postgresql.JSONB, nullable=True),
        sa.Column("hourly_rate", sa.Numeric(10, 2), default=0),
        sa.Column("latitude", sa.Numeric(9, 6), nullable=True),
        sa.Column("longitude", sa.Numeric(9, 6), nullable=True),
        sa.Column("image_url", sa.Text, nullable=True),
        sa.Column("co2_per_visit", sa.Numeric(5, 2), default=0.5),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "bookings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("asset_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("assets.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("state", sa.String(20), nullable=False),
        sa.Column("start_time", sa.DateTime, nullable=False),
        sa.Column("end_time", sa.DateTime, nullable=False),
        sa.Column("purpose", sa.Text, nullable=True),
        sa.Column("attendee_count", sa.Integer, nullable=True),
        sa.Column("is_recurring", sa.Boolean, default=False),
        sa.Column("recurrence_pattern", postgresql.JSONB, nullable=True),
        sa.Column("parent_booking_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bookings.id"), nullable=True),
        sa.Column("held_until", sa.DateTime, nullable=True),
        sa.Column("confirmed_at", sa.DateTime, nullable=True),
        sa.Column("cancelled_at", sa.DateTime, nullable=True),
        sa.Column("cancellation_reason", sa.String(100), nullable=True),
        sa.Column("cancellation_details", sa.Text, nullable=True),
        sa.Column("cancelled_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("alternative_offered_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("assets.id"), nullable=True),
        sa.Column("goodwill_credit_applied", sa.Integer, default=0),
        sa.Column("swap_message", sa.Text, nullable=True),
        sa.Column("reference", sa.String(50), unique=True, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("idx_bookings_asset_time", "bookings", ["asset_id", "start_time", "end_time"])
    op.create_index("idx_bookings_state", "bookings", ["state"])
    op.create_index("idx_bookings_user", "bookings", ["user_id"])

    op.create_table(
        "audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("booking_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bookings.id"), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("reason", sa.String(100), nullable=True),
        sa.Column("details", postgresql.JSONB, nullable=True),
        sa.Column("ai_reasoning", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "agent_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("agent_name", sa.String(50), nullable=False),
        sa.Column("goal", sa.Text, nullable=False),
        sa.Column("steps", postgresql.JSONB, nullable=False),
        sa.Column("final_outcome", sa.String(100), nullable=True),
        sa.Column("related_booking_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bookings.id"), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "search_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("raw_query", sa.Text, nullable=False),
        sa.Column("parsed_intent", postgresql.JSONB, nullable=True),
        sa.Column("results_count", sa.Integer, default=0),
        sa.Column("booked_asset_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("assets.id"), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "reminders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("booking_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bookings.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("remind_at", sa.DateTime, nullable=False),
        sa.Column("channel", sa.String(20), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("encouragement", sa.Text, nullable=True),
        sa.Column("sent", sa.Boolean, default=False),
        sa.Column("sent_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("reminders")
    op.drop_table("search_logs")
    op.drop_table("agent_runs")
    op.drop_table("audit_log")
    op.drop_index("idx_bookings_user", table_name="bookings")
    op.drop_index("idx_bookings_state", table_name="bookings")
    op.drop_index("idx_bookings_asset_time", table_name="bookings")
    op.drop_table("bookings")
    op.drop_table("assets")
    op.drop_table("users")
